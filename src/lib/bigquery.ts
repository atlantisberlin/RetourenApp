import { BigQuery } from '@google-cloud/bigquery'
import type { Order, OrderItem } from './types'

const PROJECT = process.env.BQ_PROJECT ?? 'zentrallager'
const DATASET = process.env.BQ_DATASET ?? 'xanario_shop'
const T_ORDERS = process.env.BQ_TABLE_ORDERS ?? 'shop_orders'
const T_ITEMS = process.env.BQ_TABLE_ITEMS ?? 'shop_orders_products'
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
  customers_number?: string
  date_purchased?: string
  orders_status?: string | number
  bs_nr?: string
}

const IMAGE_BASE = 'https://www.atlantiscloud.de/images/products/normal/'

type BQItemRow = {
  orders_products_id?: string | number
  products_id?: string | number
  products_name?: string
  products_model?: string
  products_quantity?: string | number
  final_price?: string | number
  products_image?: string
}

function mapOrder(row: BQOrderRow, items: BQItemRow[]): Order {
  return {
    id: String(row.orders_id),
    orderNumber: row.bs_nr ?? String(row.orders_id),
    date: row.date_purchased
      ? new Date(row.date_purchased).toLocaleDateString('de-DE')
      : '—',
    customerName: row.delivery_name ?? '—',
    customerEmail: row.customers_email_address ?? '',
    customerNumber: String(row.customers_id ?? '—'),
    invoiceNumber: row.bs_nr,
    deliveryNoteNumber: undefined,
    status: String(row.orders_status ?? ''),
    source: 'Zentrallager',
    items: items.map((item, i) => ({
      id: String(item.orders_products_id ?? i),
      productId: String(item.products_id ?? ''),
      productName: item.products_name ?? '—',
      sku: item.products_model,
      quantity: Number(item.products_quantity ?? 1),
      price: Number(item.final_price ?? 0),
      imageUrl: item.products_image ? IMAGE_BASE + item.products_image : undefined,
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
      o.delivery_name,
      o.customers_email_address,
      o.date_purchased,
      o.orders_status,
      o.bs_nr
    FROM ${table(T_ORDERS)} o
    WHERE
      ${isNumeric ? `o.orders_id = @q OR o.customers_id = @q OR` : ''}
      o.bs_nr = @q OR
      LOWER(o.delivery_name) LIKE LOWER(@name)
    ORDER BY o.date_purchased DESC
    LIMIT 20
  `
  const params: Record<string, string> = { q, name: nameSearch }

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
      i.orders_products_id,
      i.orders_id,
      i.products_id,
      i.products_name,
      i.products_model,
      i.products_quantity,
      i.final_price,
      p.products_image
    FROM ${table(T_ITEMS)} i
    LEFT JOIN ${table('shop_products')} p ON i.products_id = p.products_id
    WHERE i.orders_id IN (${placeholders})
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
      o.delivery_name,
      o.customers_email_address,
      o.date_purchased,
      o.orders_status,
      o.bs_nr
    FROM ${table(T_ORDERS)} o
    WHERE o.orders_id = @id
    LIMIT 1
  `
  const [rows] = await bq.query({ query: sql, params: { id } })
  if (!rows || rows.length === 0) return null

  const itemSql = `
    SELECT
      i.orders_products_id,
      i.orders_id,
      i.products_id,
      i.products_name,
      i.products_model,
      i.products_quantity,
      i.final_price,
      p.products_image
    FROM ${table(T_ITEMS)} i
    LEFT JOIN ${table('shop_products')} p ON i.products_id = p.products_id
    WHERE i.orders_id = @id
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
