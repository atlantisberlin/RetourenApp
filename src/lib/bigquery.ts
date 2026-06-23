import { BigQuery } from '@google-cloud/bigquery'
import type { Order, OrderItem } from './types'

const PROJECT = process.env.BQ_PROJECT ?? 'zentrallager'
const DATASET = process.env.BQ_DATASET ?? 'xanario_shop'
const T_ORDERS = process.env.BQ_TABLE_ORDERS ?? 'shop_orders'
const T_ITEMS = process.env.BQ_TABLE_ITEMS ?? 'shop_order_products'
const T_CUSTOMERS = process.env.BQ_TABLE_CUSTOMERS ?? 'shop_customers'

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
      _bq = new BigQuery({ projectId: PROJECT, credentials: creds })
    } else {
      _bq = new BigQuery({ projectId: PROJECT })
    }
    return _bq
  } catch {
    return null
  }
}

type BQOrderRow = {
  orders_id: string | number
  customers_id?: string | number
  customers_name?: string
  customers_email_address?: string
  customers_number?: string
  date_purchased?: string
  orders_status?: string | number
  orders_id_str?: string
  invoice_number?: string
  lieferschein_number?: string
}

type BQItemRow = {
  orders_products_id?: string | number
  products_id?: string | number
  products_name?: string
  products_model?: string
  products_quantity?: string | number
  final_price?: string | number
}

function mapOrder(row: BQOrderRow, items: BQItemRow[]): Order {
  return {
    id: String(row.orders_id),
    orderNumber: String(row.orders_id),
    date: row.date_purchased
      ? new Date(row.date_purchased).toLocaleDateString('de-DE')
      : '—',
    customerName: row.customers_name ?? '—',
    customerEmail: row.customers_email_address ?? '',
    customerNumber: String(row.customers_id ?? '—'),
    invoiceNumber: row.invoice_number,
    deliveryNoteNumber: row.lieferschein_number,
    status: String(row.orders_status ?? ''),
    source: 'Zentrallager',
    items: items.map((item, i) => ({
      id: String(item.orders_products_id ?? i),
      productId: String(item.products_id ?? ''),
      productName: item.products_name ?? '—',
      sku: item.products_model,
      quantity: Number(item.products_quantity ?? 1),
      price: Number(item.final_price ?? 0),
    })),
  }
}

export async function searchOrders(query: string): Promise<Order[]> {
  const bq = getClient()
  if (!bq) return []

  const q = query.trim()
  const isNumeric = /^\d+$/.test(q)
  const nameSearch = `%${q}%`

  const sql = `
    SELECT DISTINCT
      o.orders_id,
      o.customers_id,
      o.customers_name,
      o.customers_email_address,
      o.date_purchased,
      o.orders_status,
      o.invoice_number,
      o.lieferschein_number
    FROM ${table(T_ORDERS)} o
    WHERE
      ${isNumeric ? `o.orders_id = @num OR CAST(o.customers_id AS STRING) = @q OR` : ''}
      LOWER(o.customers_name) LIKE LOWER(@name)
    ORDER BY o.date_purchased DESC
    LIMIT 20
  `
  const params: Record<string, string | number> = { q, name: nameSearch }
  if (isNumeric) params.num = Number(q)

  const [rows] = await bq.query({ query: sql, params })

  if (!rows || rows.length === 0) return []

  const orderIds = (rows as BQOrderRow[]).map((r) => String(r.orders_id))
  const placeholders = orderIds.map((_, i) => `@id${i}`).join(',')
  const itemParams: Record<string, string> = {}
  orderIds.forEach((id, i) => {
    itemParams[`id${i}`] = id
  })

  const itemSql = `
    SELECT
      orders_products_id,
      orders_id,
      products_id,
      products_name,
      products_model,
      products_quantity,
      final_price
    FROM ${table(T_ITEMS)}
    WHERE CAST(orders_id AS STRING) IN (${placeholders})
  `
  const [itemRows] = await bq.query({ query: itemSql, params: itemParams })

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
      o.customers_name,
      o.customers_email_address,
      o.date_purchased,
      o.orders_status,
      o.invoice_number,
      o.lieferschein_number
    FROM ${table(T_ORDERS)} o
    WHERE CAST(o.orders_id AS STRING) = @id
    LIMIT 1
  `
  const [rows] = await bq.query({ query: sql, params: { id } })
  if (!rows || rows.length === 0) return null

  const itemSql = `
    SELECT
      orders_products_id,
      orders_id,
      products_id,
      products_name,
      products_model,
      products_quantity,
      final_price
    FROM ${table(T_ITEMS)}
    WHERE CAST(orders_id AS STRING) = @id
  `
  const [itemRows] = await bq.query({ query: itemSql, params: { id } })
  return mapOrder((rows as BQOrderRow[])[0], itemRows as BQItemRow[])
}

export function isBigQueryConfigured(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCP_SERVICE_ACCOUNT_JSON
  )
}
