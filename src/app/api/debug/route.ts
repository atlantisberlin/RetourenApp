import { BigQuery } from '@google-cloud/bigquery'

const PROJECT = process.env.BQ_PROJECT ?? 'zentrallager'
const DATASET = process.env.BQ_DATASET ?? 'ATLOS'
const T_ORDERS = process.env.BQ_TABLE_ORDERS ?? 'atlos_orders'
const T_CUSTOMERS = process.env.BQ_TABLE_CUSTOMERS ?? 'atlos_customers'
const T_ITEMS = process.env.BQ_TABLE_ITEMS ?? 'atlos_orders_products'
const T_INVOICE = process.env.BQ_TABLE_INVOICE ?? 'atlos_invoice'
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
  } catch (e) {
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
      cust.customers_nr,
      inv.orders_rechnungsdatum
    FROM ${table(T_ORDERS)} o
    LEFT JOIN (
      SELECT customers_id, ANY_VALUE(customers_nr) AS customers_nr
      FROM ${table(T_CUSTOMERS)} GROUP BY customers_id
    ) cust ON o.customers_id = cust.customers_id
    LEFT JOIN (
      SELECT orders_id, ANY_VALUE(orders_rechnungsdatum) AS orders_rechnungsdatum
      FROM ${table(T_INVOICE)} GROUP BY orders_id
    ) inv ON o.orders_id = inv.orders_id
    WHERE
      ${isNumeric ? `o.orders_id = @q OR o.customers_id = @q OR` : ''}
      o.bs_nr = @q OR
      LOWER(CONCAT(COALESCE(o.delivery_firstname, ''), ' ', COALESCE(o.delivery_lastname, ''))) LIKE LOWER(@name)
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
  }

  const allOk = steps.every((s) => (s as { ok: boolean }).ok)
  return Response.json({ allOk, dataset: `${PROJECT}.${DATASET}`, query: q, targetId, steps })
}
