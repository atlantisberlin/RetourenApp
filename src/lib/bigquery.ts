import { BigQuery } from '@google-cloud/bigquery'
import type { Order, OrderItem } from './types'

const PROJECT = process.env.BQ_PROJECT ?? 'zentrallager'
const DATASET = process.env.BQ_DATASET ?? 'ATLOS'
const T_ORDERS = process.env.BQ_TABLE_ORDERS ?? 'atlos_orders'
const T_CUSTOMERS = process.env.BQ_TABLE_CUSTOMERS ?? 'atlos_customers'
const T_PRODUCTS = process.env.BQ_TABLE_PRODUCTS ?? 'atlos_products'
const T_INVOICE = process.env.BQ_TABLE_INVOICE ?? 'atlos_invoice'
const T_INVOICE_PRODUCTS = process.env.BQ_TABLE_INVOICE_PRODUCTS ?? 'atlos_invoice_products'
const T_RETOUREN = process.env.BQ_TABLE_RETOUREN ?? 'atlos_retouren'
const T_RETOUREN_PRODUCTS = process.env.BQ_TABLE_RETOUREN_PRODUCTS ?? 'atlos_retouren_products'
const T_GUTSCHRIFT = process.env.BQ_TABLE_GUTSCHRIFT ?? 'atlos_gutschrift'
const T_GUTSCHRIFT_PRODUCTS = process.env.BQ_TABLE_GUTSCHRIFT_PRODUCTS ?? 'atlos_gutschrift_products'

function table(name: string) {
  return `\`${PROJECT}.${DATASET}.${name}\``
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

function mapOrder(row: BQOrderRow, items: BQItemRow[]): Order {
  let invoiceDate: string | undefined
  let invoiceDateWarning: boolean | undefined
  if (row.orders_rechnungsdatum) {
    const d = new Date(row.orders_rechnungsdatum)
    if (!isNaN(d.getTime())) {
      invoiceDate = d.toLocaleDateString('de-DE')
      const diffDays = (Date.now() - d.getTime()) / 86_400_000
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
    status: String(row.orders_status ?? ''),
    source: 'ATLOS',
    partnershop: isAmazon(row) ? 'amazon' : (row.partnershop ?? undefined),
    externOrderId: row.extern_orders_id ?? undefined,
    items: items.map((item, i) => mapItem(item, i)),
  }
}

// Fetches invoice_products with inline retoure/gutschrift for a set of orders_ids
async function fetchItems(bq: BigQuery, orderIds: string[]): Promise<BQItemRow[]> {
  const placeholders = orderIds.map((_, i) => `@id${i}`).join(',')
  const itemParams: Record<string, string> = {}
  orderIds.forEach((id, i) => { itemParams[`id${i}`] = id })

  const sql = `
    SELECT
      ip.invoice_products_id,
      inv.orders_id,
      ip.products_id,
      ip.products_name,
      ip.products_model,
      ip.final_price,
      ip.products_quantity,
      p.products_image,
      COALESCE(ret_id.retouren_nr, ret_pid.retouren_nr) AS retouren_nr,
      COALESCE(gut_id.gutschrift_nr, gut_pid.gutschrift_nr) AS gutschrift_nr
    FROM ${table(T_INVOICE_PRODUCTS)} ip
    JOIN ${table(T_INVOICE)} inv ON ip.invoice_id = inv.invoice_id
    LEFT JOIN (
      SELECT rp.invoice_products_id, ANY_VALUE(r.retouren_nr) AS retouren_nr
      FROM ${table(T_RETOUREN_PRODUCTS)} rp
      JOIN ${table(T_RETOUREN)} r ON rp.retouren_id = r.retouren_id
      WHERE rp.invoice_products_id IS NOT NULL
      GROUP BY rp.invoice_products_id
    ) ret_id ON ip.invoice_products_id = ret_id.invoice_products_id
    LEFT JOIN (
      SELECT rp.products_id, inv2.orders_id, ANY_VALUE(r.retouren_nr) AS retouren_nr
      FROM ${table(T_RETOUREN_PRODUCTS)} rp
      JOIN ${table(T_RETOUREN)} r ON rp.retouren_id = r.retouren_id
      JOIN ${table(T_INVOICE)} inv2 ON r.invoice_id = inv2.invoice_id
      GROUP BY rp.products_id, inv2.orders_id
    ) ret_pid ON ip.products_id = ret_pid.products_id AND inv.orders_id = ret_pid.orders_id
    LEFT JOIN (
      SELECT gp.invoice_products_id, ANY_VALUE(g.gutschrift_nr) AS gutschrift_nr
      FROM ${table(T_GUTSCHRIFT_PRODUCTS)} gp
      JOIN ${table(T_GUTSCHRIFT)} g ON gp.gutschrift_id = g.gutschrift_id
      WHERE gp.invoice_products_id IS NOT NULL
      GROUP BY gp.invoice_products_id
    ) gut_id ON ip.invoice_products_id = gut_id.invoice_products_id
    LEFT JOIN (
      SELECT gp.products_id, inv2.orders_id, ANY_VALUE(g.gutschrift_nr) AS gutschrift_nr
      FROM ${table(T_GUTSCHRIFT_PRODUCTS)} gp
      JOIN ${table(T_GUTSCHRIFT)} g ON gp.gutschrift_id = g.gutschrift_id
      JOIN ${table(T_INVOICE)} inv2 ON g.invoice_id = inv2.invoice_id
      GROUP BY gp.products_id, inv2.orders_id
    ) gut_pid ON ip.products_id = gut_pid.products_id AND inv.orders_id = gut_pid.orders_id
    LEFT JOIN (
      SELECT products_id, ANY_VALUE(products_image) AS products_image
      FROM ${table(T_PRODUCTS)} GROUP BY products_id
    ) p ON ip.products_id = p.products_id
    WHERE inv.orders_id IN (${placeholders})
  `
  const [rows] = await bq.query({ query: sql, params: itemParams })
  return rows as BQItemRow[]
}

export async function searchOrders(query: string): Promise<Order[]> {
  const bq = getClient()
  if (!bq) return []

  const q = query.trim()
  const isNumeric = /^\d+$/.test(q)
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
      inv.invoice_nr
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
      LOWER(CONCAT(COALESCE(o.delivery_firstname, ''), ' ', COALESCE(o.delivery_lastname, ''))) LIKE LOWER(@name) OR
      LOWER(CONCAT(COALESCE(o.billing_firstname, ''), ' ', COALESCE(o.billing_lastname, ''))) LIKE LOWER(@name)
    ORDER BY o.date_purchased DESC
    LIMIT 20
  `
  const params: Record<string, string> = { q, name: nameSearch }

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

  return (rows as BQOrderRow[]).map((r) =>
    mapOrder(r, itemsByOrder[String(r.orders_id)] ?? [])
  )
}

export async function getOrder(id: string): Promise<Order | null> {
  const bq = getClient()
  if (!bq) return null

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
      inv.invoice_nr
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
    WHERE o.orders_id = @id
    LIMIT 1
  `
  const [rows] = await bq.query({ query: sql, params: { id } })
  if (!rows || rows.length === 0) return null

  const itemRows = await fetchItems(bq, [id])
  return mapOrder((rows as BQOrderRow[])[0], itemRows)
}

export async function getOrderByRetourenNr(retourenNr: string): Promise<Order | null> {
  const bq = getClient()
  if (!bq) return null

  const [retRows] = await bq.query({
    query: `SELECT retouren_id, invoice_id FROM ${table(T_RETOUREN)} WHERE retouren_nr = @nr LIMIT 1`,
    params: { nr: retourenNr },
  })
  if (!retRows || retRows.length === 0) return null

  const { retouren_id, invoice_id } = retRows[0] as { retouren_id: string; invoice_id: string }

  const [invRows] = await bq.query({
    query: `SELECT orders_id FROM ${table(T_INVOICE)} WHERE invoice_id = @id LIMIT 1`,
    params: { id: String(invoice_id) },
  })
  if (!invRows || invRows.length === 0) return null

  const orderId = String((invRows[0] as { orders_id: string }).orders_id)
  const order = await getOrder(orderId)
  if (!order) return null

  const [rpRows] = await bq.query({
    query: `SELECT invoice_products_id FROM ${table(T_RETOUREN_PRODUCTS)} WHERE retouren_id = @id`,
    params: { id: String(retouren_id) },
  })
  const activeIds = new Set(
    (rpRows as { invoice_products_id: string }[]).map((r) => String(r.invoice_products_id))
  )

  return {
    ...order,
    activeRetourenNr: retourenNr,
    items: order.items.map((item) => ({
      ...item,
      inActiveRetoure: activeIds.has(item.id),
    })),
  }
}

export function isBigQueryConfigured(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCP_SERVICE_ACCOUNT_JSON
  )
}
