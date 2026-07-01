import { BigQuery } from '@google-cloud/bigquery'

const PROJECT = process.env.BQ_PROJECT ?? 'zentrallager'
const DATASET = process.env.BQ_DATASET ?? 'ATLOS'
const T_ORDERS = process.env.BQ_TABLE_ORDERS ?? 'atlos_orders'
const T_CUSTOMERS = process.env.BQ_TABLE_CUSTOMERS ?? 'atlos_customers'
const T_ITEMS = process.env.BQ_TABLE_ITEMS ?? 'atlos_orders_products'
const T_INVOICE = process.env.BQ_TABLE_INVOICE ?? 'atlos_invoice'
const T_INVOICE_PRODUCTS = process.env.BQ_TABLE_INVOICE_PRODUCTS ?? 'atlos_invoice_products'
const T_RETOUREN = process.env.BQ_TABLE_RETOUREN ?? 'atlos_retouren'
const T_RETOUREN_PRODUCTS = process.env.BQ_TABLE_RETOUREN_PRODUCTS ?? 'atlos_retouren_products'
const T_GUTSCHRIFT = process.env.BQ_TABLE_GUTSCHRIFT ?? 'atlos_gutschrift'
const T_GUTSCHRIFT_PRODUCTS = process.env.BQ_TABLE_GUTSCHRIFT_PRODUCTS ?? 'atlos_gutschrift_products'

function table(name: string) {
  return `\`${PROJECT}.${DATASET}.${name}\``
}

function getClient(): BigQuery | null {
  try {
    if (process.env.GCP_SERVICE_ACCOUNT_JSON) {
      const creds = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON)
      return new BigQuery({ projectId: PROJECT, credentials: creds, location: 'europe-west3' })
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return new BigQuery({ projectId: PROJECT, location: 'europe-west3' })
    }
    return null
  } catch {
    return null
  }
}

async function runStep(label: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn()
    return { step: label, ok: true, result }
  } catch (e) {
    return { step: label, ok: false, error: String(e), stack: (e as Error)?.stack }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const id = searchParams.get('id') ?? ''

  const bq = getClient()
  if (!bq) {
    return Response.json({ error: 'BigQuery nicht konfiguriert — keine Credentials gefunden' }, { status: 500 })
  }

  const steps: unknown[] = []

  // Schritt 1: Bestellungssuche
  const isNumeric = /^\d+$/.test(q.trim())
  const orderSql = `
    SELECT
      o.orders_id,
      o.customers_id,
      CONCAT(COALESCE(o.delivery_firstname, ''), ' ', COALESCE(o.delivery_lastname, '')) AS delivery_name,
      o.bs_nr,
      o.orders_status,
      o.date_purchased,
      o.partnershop,
      o.extern_orders_id,
      cust.customers_nr,
      inv.orders_rechnungsdatum,
      inv.invoice_nr
    FROM ${table(T_ORDERS)} o
    LEFT JOIN (
      SELECT customers_id, ANY_VALUE(customers_nr) AS customers_nr
      FROM ${table(T_CUSTOMERS)} GROUP BY customers_id
    ) cust ON o.customers_id = cust.customers_id
    LEFT JOIN (
      SELECT orders_id, ANY_VALUE(orders_rechnungsdatum) AS orders_rechnungsdatum, ANY_VALUE(invoice_nr) AS invoice_nr
      FROM ${table(T_INVOICE)} GROUP BY orders_id
    ) inv ON o.orders_id = inv.orders_id
    WHERE
      ${isNumeric ? `o.orders_id = @q OR o.customers_id = @q OR` : ''}
      o.bs_nr = @q OR
      o.extern_orders_id = @q OR
      cust.customers_nr = @q OR
      inv.invoice_nr = @q OR
      o.orders_id IN (
        SELECT DISTINCT inv2.orders_id
        FROM ${table(T_RETOUREN)} r2
        JOIN ${table(T_INVOICE)} inv2 ON r2.invoice_id = inv2.invoice_id
        WHERE r2.retouren_nr = @q
      ) OR
      o.orders_id IN (
        SELECT DISTINCT inv3.orders_id
        FROM ${table(T_GUTSCHRIFT)} g3
        JOIN ${table(T_INVOICE)} inv3 ON g3.invoice_id = inv3.invoice_id
        WHERE g3.gutschrift_nr = @q
      ) OR
      LOWER(CONCAT(COALESCE(o.delivery_firstname, ''), ' ', COALESCE(o.delivery_lastname, ''))) LIKE LOWER(@name) OR
      LOWER(CONCAT(COALESCE(o.billing_firstname, ''), ' ', COALESCE(o.billing_lastname, ''))) LIKE LOWER(@name)
    ORDER BY o.date_purchased DESC
    LIMIT 5
  `

  const orderStep = await runStep('1_orders_search', async () => {
    const [rows] = await bq.query({ query: orderSql, params: { q: q.trim(), name: `%${q.trim()}%` } })
    return { count: rows.length, rows }
  })
  steps.push(orderStep)

  // Schritt 2: Artikel für eine Bestellung (per id oder erste gefundene)
  const targetId = id || (
    (orderStep as { ok: boolean; result?: { rows?: { orders_id: string }[] } }).ok
      ? ((orderStep as { result: { rows: { orders_id: string }[] } }).result.rows[0]?.orders_id ?? null)
      : null
  )

  if (targetId) {
    steps.push(await runStep('2_items', async () => {
      const [rows] = await bq.query({
        query: `SELECT i.orders_products_id, i.products_id, i.products_name, i.products_model, i.products_quantity
                FROM ${table(T_ITEMS)} i WHERE i.orders_id = @id`,
        params: { id: String(targetId) },
      })
      return { orders_id: targetId, count: rows.length, rows }
    }))

    steps.push(await runStep('3_invoice', async () => {
      const [rows] = await bq.query({
        query: `SELECT invoice_id, invoice_nr, orders_rechnungsdatum FROM ${table(T_INVOICE)} WHERE orders_id = @id LIMIT 5`,
        params: { id: String(targetId) },
      })
      return { count: rows.length, rows }
    }))

    steps.push(await runStep('3b_invoice_products', async () => {
      const [rows] = await bq.query({
        query: `SELECT ip.invoice_products_id, ip.products_id, ip.products_name, ip.products_model, ip.products_quantity, ip.final_price
                FROM ${table(T_INVOICE_PRODUCTS)} ip
                JOIN ${table(T_INVOICE)} inv ON ip.invoice_id = inv.invoice_id
                WHERE inv.orders_id = @id`,
        params: { id: String(targetId) },
      })
      return { count: rows.length, rows }
    }))

    steps.push(await runStep('4_retouren', async () => {
      const [rows] = await bq.query({
        query: `SELECT rp.products_id, rp.products_name, r.retouren_nr, r.invoice_id
                FROM ${table(T_RETOUREN_PRODUCTS)} rp
                JOIN ${table(T_RETOUREN)} r ON rp.retouren_id = r.retouren_id
                JOIN ${table(T_INVOICE)} inv ON r.invoice_id = inv.invoice_id
                WHERE inv.orders_id = @id`,
        params: { id: String(targetId) },
      })
      return { count: rows.length, rows }
    }))

    steps.push(await runStep('5_gutschriften', async () => {
      const [rows] = await bq.query({
        query: `SELECT gp.products_id, gp.products_name, g.gutschrift_nr, g.invoice_id
                FROM ${table(T_GUTSCHRIFT_PRODUCTS)} gp
                JOIN ${table(T_GUTSCHRIFT)} g ON gp.gutschrift_id = g.gutschrift_id
                JOIN ${table(T_INVOICE)} inv ON g.invoice_id = inv.invoice_id
                WHERE inv.orders_id = @id`,
        params: { id: String(targetId) },
      })
      return { count: rows.length, rows }
    }))

    steps.push(await runStep('5b_gutschrift_raw', async () => {
      // Step 1: find gutschrift records for this order's invoice
      const [gRows] = await bq.query({
        query: `SELECT g.gutschrift_id, g.gutschrift_nr, g.invoice_id, g.invoice_nr
                FROM ${table(T_GUTSCHRIFT)} g
                JOIN ${table(T_INVOICE)} inv ON g.invoice_id = inv.invoice_id
                WHERE inv.orders_id = @id`,
        params: { id: String(targetId) },
      })
      if (!gRows || gRows.length === 0) return { gutschriften: [], gutschrift_products: [] }
      const gids = (gRows as { gutschrift_id: string }[]).map(r => r.gutschrift_id)
      // Step 2: get all product rows for these gutschriften
      const gidPlaceholders = gids.map((_, i) => `@gid${i}`).join(',')
      const gidParams: Record<string, string> = {}
      gids.forEach((gid, i) => { gidParams[`gid${i}`] = String(gid) })
      const [gpRows] = await bq.query({
        query: `SELECT * FROM ${table(T_GUTSCHRIFT_PRODUCTS)} WHERE gutschrift_id IN (${gidPlaceholders}) LIMIT 20`,
        params: gidParams,
      })
      return { gutschriften: gRows, gutschrift_products: gpRows }
    }))

    steps.push(await runStep('5c_retoure_raw', async () => {
      const [rRows] = await bq.query({
        query: `SELECT r.retouren_id, r.retouren_nr, r.invoice_id
                FROM ${table(T_RETOUREN)} r
                JOIN ${table(T_INVOICE)} inv ON r.invoice_id = inv.invoice_id
                WHERE inv.orders_id = @id`,
        params: { id: String(targetId) },
      })
      if (!rRows || rRows.length === 0) return { retouren: [], retouren_products: [] }
      const rids = (rRows as { retouren_id: string }[]).map(r => r.retouren_id)
      const ridPlaceholders = rids.map((_, i) => `@rid${i}`).join(',')
      const ridParams: Record<string, string> = {}
      rids.forEach((rid, i) => { ridParams[`rid${i}`] = String(rid) })
      const [rpRows] = await bq.query({
        query: `SELECT * FROM ${table(T_RETOUREN_PRODUCTS)} WHERE retouren_id IN (${ridPlaceholders}) LIMIT 20`,
        params: ridParams,
      })
      return { retouren: rRows, retouren_products: rpRows }
    }))
  }

  // Schritt 6: Datenmenge und neueste/älteste Bestellungen in ATLOS
  steps.push(await runStep('6_atlos_overview', async () => {
    const [rows] = await bq.query({
      query: `SELECT COUNT(*) AS total,
                MIN(date_purchased) AS aelteste,
                MAX(date_purchased) AS neueste
              FROM ${table(T_ORDERS)}`,
      params: {},
    })
    return rows[0]
  }))

  // Schritt 7: Existiert die orders_id irgendwie ähnlich (LIKE)?
  if (q.trim()) {
    steps.push(await runStep('7_orders_id_like', async () => {
      const [rows] = await bq.query({
        query: `SELECT orders_id, bs_nr,
                  CONCAT(COALESCE(delivery_firstname,''),' ',COALESCE(delivery_lastname,'')) AS name,
                  date_purchased
                FROM ${table(T_ORDERS)}
                WHERE orders_id LIKE @pattern OR bs_nr LIKE @pattern
                LIMIT 5`,
        params: { pattern: `%${q.trim()}%` },
      })
      return { count: rows.length, rows }
    }))
  }

  // Schritt 8: Existiert die Bestellung im alten xanario_shop?
  if (q.trim()) {
    steps.push(await runStep('8_xanario_shop_check', async () => {
      const xDataset = 'xanario_shop'
      const xTable = `\`${PROJECT}.${xDataset}.shop_orders\``
      const [rows] = await bq.query({
        query: `SELECT orders_id, bs_nr,
                  delivery_name,
                  date_purchased,
                  orders_status
                FROM ${xTable}
                WHERE orders_id = @q OR bs_nr = @q OR delivery_name LIKE @name
                LIMIT 5`,
        params: { q: q.trim(), name: `%${q.trim()}%` },
      })
      return { dataset: `${PROJECT}.${xDataset}`, count: rows.length, rows }
    }))
  }

  // Schritt 9: Kunden-Namenssuche in ATLOS (unabhängig von ID)
  const namePart = q.trim().split(/\s+/)
  if (namePart.length >= 2) {
    steps.push(await runStep('9_name_search_atlos', async () => {
      const [rows] = await bq.query({
        query: `SELECT orders_id, bs_nr, extern_orders_id,
                  CONCAT(COALESCE(delivery_firstname,''),' ',COALESCE(delivery_lastname,'')) AS name,
                  date_purchased
                FROM ${table(T_ORDERS)}
                WHERE LOWER(CONCAT(COALESCE(delivery_firstname,''),' ',COALESCE(delivery_lastname,''))) LIKE LOWER(@name)
                ORDER BY date_purchased DESC LIMIT 10`,
        params: { name: `%${q.trim()}%` },
      })
      return { count: rows.length, rows }
    }))
  }

  // Schritt 10: Suche nach extern_orders_id in ATLOS
  steps.push(await runStep('10_extern_orders_id', async () => {
    const [rows] = await bq.query({
      query: `SELECT orders_id, bs_nr, extern_orders_id,
                CONCAT(COALESCE(delivery_firstname,''),' ',COALESCE(delivery_lastname,'')) AS name,
                date_purchased
              FROM ${table(T_ORDERS)}
              WHERE extern_orders_id = @q OR extern_orders_id LIKE @pattern
              LIMIT 5`,
      params: { q: q.trim(), pattern: `%${q.trim()}%` },
    })
    return { count: rows.length, rows }
  }))

  // Schritt 11: Lieferschein-Suche über xanario_shop
  if (q.trim()) {
    steps.push(await runStep('11_packingslip', async () => {
      const xDataset = process.env.BQ_XANARIO_DATASET ?? 'xanario_shop'
      const xPackingslip = `\`${PROJECT}.${xDataset}.shop_packingslip\``
      const xOrders = `\`${PROJECT}.${xDataset}.shop_orders\``
      const [rows] = await bq.query({
        query: `SELECT xp.packingslip_nr, xp.orders_id AS xanario_orders_id, xo.extern_orders_id AS atlos_bs_nr
                FROM ${xPackingslip} xp
                JOIN ${xOrders} xo ON xp.orders_id = xo.orders_id
                WHERE xp.packingslip_nr = @q
                LIMIT 5`,
        params: { q: q.trim() },
      })
      return { count: rows.length, rows }
    }))
  }

  const allOk = steps.every((s) => (s as { ok: boolean }).ok)
  return Response.json({ allOk, dataset: `${PROJECT}.${DATASET}`, query: q, targetId, steps })
}
