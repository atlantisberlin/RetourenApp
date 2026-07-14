import { BigQuery } from '@google-cloud/bigquery'
import type { Order, OrderItem } from './types'

const PROJECT = process.env.BQ_PROJECT ?? 'zentrallager'
const DATASET = process.env.BQ_DATASET ?? 'ATLOS'
const T_ORDERS = process.env.BQ_TABLE_ORDERS ?? 'atlos_orders'
const T_ORDERS_PRODUCTS = process.env.BQ_TABLE_ORDERS_PRODUCTS ?? 'atlos_orders_products'
const T_CUSTOMERS = process.env.BQ_TABLE_CUSTOMERS ?? 'atlos_customers'
const T_PRODUCTS = process.env.BQ_TABLE_PRODUCTS ?? 'atlos_products'
const T_INVOICE = process.env.BQ_TABLE_INVOICE ?? 'atlos_invoice'
const T_INVOICE_PRODUCTS = process.env.BQ_TABLE_INVOICE_PRODUCTS ?? 'atlos_invoice_products'
const T_RETOUREN = process.env.BQ_TABLE_RETOUREN ?? 'atlos_retouren'
const T_RETOUREN_PRODUCTS = process.env.BQ_TABLE_RETOUREN_PRODUCTS ?? 'atlos_retouren_products'
const T_GUTSCHRIFT = process.env.BQ_TABLE_GUTSCHRIFT ?? 'atlos_gutschrift'
const T_GUTSCHRIFT_PRODUCTS = process.env.BQ_TABLE_GUTSCHRIFT_PRODUCTS ?? 'atlos_gutschrift_products'

const XANARIO_DATASET = process.env.BQ_XANARIO_DATASET ?? 'xanario_shop'
const T_XANARIO_ORDERS = process.env.BQ_TABLE_XANARIO_ORDERS ?? 'shop_orders'
const T_XANARIO_PACKINGSLIP = process.env.BQ_TABLE_XANARIO_PACKINGSLIP ?? 'shop_packingslip'

function table(name: string) {
  return `\`${PROJECT}.${DATASET}.${name}\``
}

function xTable(name: string) {
  return `\`${PROJECT}.${XANARIO_DATASET}.${name}\``
}

let _bq: BigQuery | null = null
function getClient(): BigQuery | null {
  if (_bq) return _bq
  const hasKey = !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCP_SERVICE_ACCOUNT_JSON
  )
  if (!hasKey && process.env.NODE_ENV !== 'production') return null
  try {
    if (process.env.GCP_SERVICE_ACCOUNT_JSON) {
      const creds = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON)
      _bq = new BigQuery({ projectId: PROJECT, credentials: creds, location: 'europe-west3' })
    } else {
      _bq = new BigQuery({ projectId: PROJECT, location: 'europe-west3' })
    }
    return _bq
  } catch {
    return null
  }
}

type BQOrderRow = {
  orders_id: string | number
  customers_id?: string | number
  delivery_name?: string
  customers_email_address?: string
  date_purchased?: string
  orders_status?: string | number
  bs_nr?: string
  customers_nr?: string
  orders_rechnungsdatum?: string
  invoice_nr?: string
  partnershop?: string
  extern_orders_id?: string
  packingslip_nr?: string
}

type BQItemRow = {
  invoice_products_id?: string | number
  orders_id?: string | number
  products_id?: string | number
  products_name?: string
  products_model?: string
  products_quantity?: string | number
  final_price?: string | number
  products_image?: string
  retouren_nr?: string | null
  gutschrift_nr?: string | null
}

const IMAGE_BASE = 'https://www.atlantiscloud.de/images/products/normal/'
const AMAZON_EXTERN_PATTERN = /^\d{3}-\d{7}-\d{7}$/

function isAmazon(row: BQOrderRow): boolean {
  if (row.partnershop && row.partnershop.toLowerCase() === 'amazon') return true
  if (row.extern_orders_id && AMAZON_EXTERN_PATTERN.test(row.extern_orders_id.trim())) return true
  return false
}

function isEbay(row: BQOrderRow): boolean {
  return !!(row.partnershop && row.partnershop.toLowerCase() === 'ebay')
}

function mapItem(item: BQItemRow, idx: number): OrderItem {
  return {
    id: String(item.invoice_products_id ?? idx),
    productId: String(item.products_id ?? ''),
    productName: item.products_name ?? '—',
    sku: item.products_model,
    quantity: Number(item.products_quantity ?? 1),
    price: Number(item.final_price ?? 0),
    imageUrl: item.products_image ? IMAGE_BASE + item.products_image : undefined,
    existingRetoure: item.retouren_nr ?? null,
    existingGutschrift: item.gutschrift_nr ?? null,
  }
}

function mapOrder(row: BQOrderRow, items: BQItemRow[], notInvoiced = false): Order {
  let invoiceDate: string | undefined
  let invoiceDateWarning: boolean | undefined
  let invoiceDateDays: number | undefined
  if (row.orders_rechnungsdatum) {
    const d = new Date(row.orders_rechnungsdatum)
    if (!isNaN(d.getTime())) {
      invoiceDate = d.toLocaleDateString('de-DE')
      const diffDays = (Date.now() - d.getTime()) / 86_400_000
      invoiceDateDays = Math.floor(diffDays)
      if (diffDays > 14) invoiceDateWarning = true
    }
  }

  return {
    id: String(row.orders_id),
    orderNumber: row.bs_nr ?? String(row.orders_id),
    date: row.date_purchased
      ? new Date(row.date_purchased).toLocaleDateString('de-DE')
      : '—',
    customerName: row.delivery_name ?? '—',
    customerEmail: row.customers_email_address ?? '',
    customerNumber: row.customers_nr ?? String(row.customers_id ?? '—'),
    invoiceNumber: row.bs_nr,
    invoiceNr: row.invoice_nr,
    invoiceDate,
    invoiceDateWarning,
    invoiceDateDays,
    status: String(row.orders_status ?? ''),
    source: 'ATLOS',
    partnershop: isAmazon(row) ? 'amazon' : isEbay(row) ? 'ebay' : (row.partnershop ?? undefined),
    externOrderId: row.extern_orders_id ?? undefined,
    deliveryNoteNumber: row.packingslip_nr ?? undefined,
    notInvoiced: notInvoiced || undefined,
    items: items.map((item, i) => mapItem(item, i)),
  }
}

// Fetches invoice_products for a set of orders_ids, with separate resilient Retoure/Gutschrift lookup
async function fetchItems(bq: BigQuery, orderIds: string[]): Promise<BQItemRow[]> {
  const placeholders = orderIds.map((_, i) => `@id${i}`).join(',')
  const itemParams: Record<string, string> = {}
  orderIds.forEach((id, i) => { itemParams[`id${i}`] = id })

  // Step 1: get invoice products (immutable — not zeroed by Gutschrift)
  const itemSql = `
    SELECT
      ip.invoice_products_id,
      inv.orders_id,
      ip.products_id,
      ip.products_name,
      ip.products_model,
      ip.final_price,
      ip.products_quantity,
      p.products_image
    FROM ${table(T_INVOICE_PRODUCTS)} ip
    JOIN ${table(T_INVOICE)} inv ON ip.invoice_id = inv.invoice_id
    LEFT JOIN (
      SELECT products_id, ANY_VALUE(products_image) AS products_image
      FROM ${table(T_PRODUCTS)} GROUP BY products_id
    ) p ON ip.products_id = p.products_id
    WHERE inv.orders_id IN (${placeholders})
  `
  const [rows] = await bq.query({ query: itemSql, params: itemParams })
  const items = rows as BQItemRow[]

  // Step 2: resilient Retoure/Gutschrift lookup by products_id + orders_id
  const retourenByKey: Record<string, string> = {}
  const gutschriftByKey: Record<string, string> = {}
  try {
    const [retRows] = await bq.query({
      query: `
        SELECT rp.products_id, inv2.orders_id, ANY_VALUE(r.retouren_nr) AS retouren_nr
        FROM ${table(T_RETOUREN_PRODUCTS)} rp
        JOIN ${table(T_RETOUREN)} r ON rp.retouren_id = r.retouren_id
        JOIN ${table(T_INVOICE)} inv2 ON r.invoice_id = inv2.invoice_id
        WHERE inv2.orders_id IN (${placeholders})
        GROUP BY rp.products_id, inv2.orders_id
      `,
      params: itemParams,
    })
    for (const row of retRows as { products_id: string; orders_id: string; retouren_nr: string }[]) {
      retourenByKey[`${row.orders_id}:${row.products_id}`] = row.retouren_nr
    }

    const [gutRows] = await bq.query({
      query: `
        SELECT gp.products_id, inv2.orders_id, ANY_VALUE(g.gutschrift_nr) AS gutschrift_nr
        FROM ${table(T_GUTSCHRIFT_PRODUCTS)} gp
        JOIN ${table(T_GUTSCHRIFT)} g ON gp.gutschrift_id = g.gutschrift_id
        JOIN ${table(T_INVOICE)} inv2 ON g.invoice_id = inv2.invoice_id
        WHERE inv2.orders_id IN (${placeholders})
        GROUP BY gp.products_id, inv2.orders_id
      `,
      params: itemParams,
    })
    for (const row of gutRows as { products_id: string; orders_id: string; gutschrift_nr: string }[]) {
      gutschriftByKey[`${row.orders_id}:${row.products_id}`] = row.gutschrift_nr
    }
  } catch (e) {
    console.error('Retoure/Gutschrift lookup failed (non-fatal):', e)
  }

  // Step 3: merge into items
  for (const item of items as (BQItemRow & { orders_id: string | number })[]) {
    const key = `${item.orders_id}:${item.products_id}`
    item.retouren_nr = retourenByKey[key] ?? null
    item.gutschrift_nr = gutschriftByKey[key] ?? null
  }

  return items
}

// Fallback: order line items from atlos_orders_products.
// Used when an order has no invoice_products in BigQuery yet (invoice not
// created/synced), so operators can still capture a return before the order
// is invoiced. Retoure/Gutschrift columns stay null — those only exist once
// the invoice has been generated.
async function fetchOrderProductItems(bq: BigQuery, orderIds: string[]): Promise<BQItemRow[]> {
  if (orderIds.length === 0) return []
  const placeholders = orderIds.map((_, i) => `@id${i}`).join(',')
  const params: Record<string, string> = {}
  orderIds.forEach((id, i) => { params[`id${i}`] = id })

  const sql = `
    SELECT
      op.orders_products_id AS invoice_products_id,
      op.orders_id,
      op.products_id,
      op.products_name,
      op.products_model,
      op.final_price,
      op.products_quantity,
      p.products_image
    FROM ${table(T_ORDERS_PRODUCTS)} op
    LEFT JOIN (
      SELECT products_id, ANY_VALUE(products_image) AS products_image
      FROM ${table(T_PRODUCTS)} GROUP BY products_id
    ) p ON op.products_id = p.products_id
    WHERE op.orders_id IN (${placeholders})
  `
  const [rows] = await bq.query({ query: sql, params })
  return rows as BQItemRow[]
}

export async function searchOrders(query: string): Promise<Order[]> {
  const bq = getClient()
  if (!bq) return []

  const q = query.trim()
  const isNumeric = /^\d+$/.test(q)
  const qLike = `%${q}%`
  const nameSearch = `%${q}%`

  const sql = `
    SELECT
      o.orders_id,
      o.customers_id,
      CONCAT(COALESCE(o.delivery_firstname, ''), ' ', COALESCE(o.delivery_lastname, '')) AS delivery_name,
      o.customers_email_address,
      o.date_purchased,
      o.orders_status,
      o.bs_nr,
      o.extern_orders_id,
      o.partnershop,
      cust.customers_nr,
      inv.orders_rechnungsdatum,
      inv.invoice_nr,
      pack.packingslip_nr
    FROM ${table(T_ORDERS)} o
    LEFT JOIN (
      SELECT customers_id, ANY_VALUE(customers_nr) AS customers_nr
      FROM ${table(T_CUSTOMERS)}
      GROUP BY customers_id
    ) cust ON o.customers_id = cust.customers_id
    LEFT JOIN (
      SELECT orders_id, ANY_VALUE(orders_rechnungsdatum) AS orders_rechnungsdatum, ANY_VALUE(invoice_nr) AS invoice_nr
      FROM ${table(T_INVOICE)}
      GROUP BY orders_id
    ) inv ON o.orders_id = inv.orders_id
    LEFT JOIN (
      SELECT xo.extern_orders_id AS bs_nr, ANY_VALUE(xp.packingslip_nr) AS packingslip_nr
      FROM ${xTable(T_XANARIO_PACKINGSLIP)} xp
      JOIN ${xTable(T_XANARIO_ORDERS)} xo ON xp.orders_id = xo.orders_id
      GROUP BY xo.extern_orders_id
    ) pack ON o.bs_nr = pack.bs_nr
    WHERE
      ${isNumeric ? `CAST(o.orders_id AS STRING) LIKE @qLike OR CAST(o.customers_id AS STRING) LIKE @qLike OR` : ''}
      o.bs_nr LIKE @qLike OR
      o.extern_orders_id LIKE @qLike OR
      cust.customers_nr LIKE @qLike OR
      inv.invoice_nr LIKE @qLike OR
      o.orders_id IN (
        SELECT DISTINCT inv2.orders_id
        FROM ${table(T_RETOUREN)} r2
        JOIN ${table(T_INVOICE)} inv2 ON r2.invoice_id = inv2.invoice_id
        WHERE r2.retouren_nr LIKE @qLike
      ) OR
      o.bs_nr IN (
        SELECT xo.extern_orders_id
        FROM ${xTable(T_XANARIO_PACKINGSLIP)} xp
        JOIN ${xTable(T_XANARIO_ORDERS)} xo ON xp.orders_id = xo.orders_id
        WHERE xp.packingslip_nr LIKE @qLike
      ) OR
      LOWER(CONCAT(COALESCE(o.delivery_firstname, ''), ' ', COALESCE(o.delivery_lastname, ''))) LIKE LOWER(@name) OR
      LOWER(CONCAT(COALESCE(o.billing_firstname, ''), ' ', COALESCE(o.billing_lastname, ''))) LIKE LOWER(@name)
    ORDER BY o.date_purchased DESC
    LIMIT 20
  `
  const params: Record<string, string> = { qLike, name: nameSearch }

  const [rows] = await bq.query({ query: sql, params })
  if (!rows || rows.length === 0) return []

  const orderIds = (rows as BQOrderRow[]).map((r) => String(r.orders_id))
  const itemRows = await fetchItems(bq, orderIds)

  const itemsByOrder: Record<string, BQItemRow[]> = {}
  for (const item of itemRows as (BQItemRow & { orders_id: string | number })[]) {
    const oid = String(item.orders_id)
    if (!itemsByOrder[oid]) itemsByOrder[oid] = []
    itemsByOrder[oid].push(item)
  }

  // Fallback: Bestellungen ohne Rechnungspositionen (Rechnung noch nicht in BQ)
  // aus atlos_orders_products befüllen, damit die Retoure trotzdem erfassbar ist.
  const notInvoiced = new Set<string>()
  const missing = orderIds.filter((oid) => !itemsByOrder[oid]?.length)
  if (missing.length > 0) {
    try {
      const fallbackRows = await fetchOrderProductItems(bq, missing)
      for (const item of fallbackRows as (BQItemRow & { orders_id: string | number })[]) {
        const oid = String(item.orders_id)
        if (!itemsByOrder[oid]) itemsByOrder[oid] = []
        itemsByOrder[oid].push(item)
        notInvoiced.add(oid)
      }
    } catch (e) {
      console.error('orders_products fallback failed (non-fatal):', e)
    }
  }

  return (rows as BQOrderRow[]).map((r) => {
    const oid = String(r.orders_id)
    return mapOrder(r, itemsByOrder[oid] ?? [], notInvoiced.has(oid))
  })
}

const T_XANARIO_PRODUCTS = process.env.BQ_TABLE_XANARIO_PRODUCTS ?? 'shop_products'
const T_XANARIO_PRODUCTS_DESC = process.env.BQ_TABLE_XANARIO_PRODUCTS_DESC ?? 'shop_products_description'

export async function searchProducts(query: string): Promise<{ productId: string; name: string; sku?: string; ean?: string; imageUrl?: string }[]> {
  const bq = getClient()
  if (!bq) return []

  const q = query.trim()
  if (!q) return []

  // Split into words for fuzzy AND-matching (each word must appear in name)
  const words = q.split(/\s+/).filter(Boolean)
  const wordConditions = words.map((_, i) => `LOWER(pd.products_name) LIKE LOWER(@w${i})`).join(' AND ')
  const wordParams: Record<string, string> = {}
  words.forEach((w, i) => { wordParams[`w${i}`] = `%${w}%` })

  const [rows] = await bq.query({
    query: `
      SELECT
        p.products_id,
        pd.products_name,
        p.products_model,
        p.sku,
        p.products_ean,
        p.products_image
      FROM ${xTable(T_XANARIO_PRODUCTS)} p
      JOIN (
        SELECT products_id, ANY_VALUE(products_name) AS products_name
        FROM ${xTable(T_XANARIO_PRODUCTS_DESC)}
        GROUP BY products_id
      ) pd ON p.products_id = pd.products_id
      WHERE
        p.products_model = @q OR
        p.sku = @q OR
        p.products_ean = @q OR
        (${wordConditions})
      LIMIT 15
    `,
    params: { q, ...wordParams },
  })

  return (rows as { products_id: string; products_name: string; products_model?: string; sku?: string; products_ean?: string; products_image?: string }[]).map(r => ({
    productId: String(r.products_id),
    name: r.products_name ?? '—',
    sku: r.products_model ?? r.sku ?? undefined,
    ean: r.products_ean ?? undefined,
    imageUrl: r.products_image ? IMAGE_BASE + r.products_image : undefined,
  }))
}
