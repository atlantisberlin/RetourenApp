import { BigQuery } from '@google-cloud/bigquery'
import type { Order, OrderItem } from './types'

const PROJECT = process.env.BQ_PROJECT ?? 'zentrallager'
const DATASET = process.env.BQ_DATASET ?? 'ATLOS'
const T_ORDERS = process.env.BQ_TABLE_ORDERS ?? 'atlos_orders'
const T_ITEMS = process.env.BQ_TABLE_ITEMS ?? 'atlos_orders_products'
const T_CUSTOMERS = process.env.BQ_TABLE_CUSTOMERS ?? 'atlos_customers'
const T_PRODUCTS = process.env.BQ_TABLE_PRODUCTS ?? 'atlos_products'
const T_INVOICE = process.env.BQ_TABLE_INVOICE ?? 'atlos_invoice'
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
  retouren_nr?: string | null
  gutschrift_nr?: string | null
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
    deliveryNoteNumber: undefined,
    invoiceDate,
    invoiceDateWarning,
    status: String(row.orders_status ?? ''),
    source: 'ATLOS',
    items: items.map((item, i) => ({
      id: String(item.orders_products_id ?? i),
      productId: String(item.products_id ?? ''),
      productName: item.products_name ?? '—',
      sku: item.products_model,
      quantity: Number(item.products_quantity ?? 1),
      price: Number(item.final_price ?? 0),
      imageUrl: item.products_image ? IMAGE_BASE + item.products_image : undefined,
      existingRetoure: item.retouren_nr ?? null,
      existingGutschrift: item.gutschrift_nr ?? null,
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
    SELECT
      o.orders_id,
      o.customers_id,
      CONCAT(COALESCE(o.delivery_firstname, ''), ' ', COALESCE(o.delivery_lastname, '')) AS delivery_name,
      o.customers_email_address,
      o.date_purchased,
      o.orders_status,
      o.bs_nr,
      cust.customers_nr,
      inv.orders_rechnungsdatum
    FROM ${table(T_ORDERS)} o
    LEFT JOIN (
      SELECT customers_id, ANY_VALUE(customers_nr) AS customers_nr
      FROM ${table(T_CUSTOMERS)}
      GROUP BY customers_id
    ) cust ON o.customers_id = cust.customers_id
    LEFT JOIN (
      SELECT orders_id, ANY_VALUE(orders_rechnungsdatum) AS orders_rechnungsdatum
      FROM ${table(T_INVOICE)}
      GROUP BY orders_id
    ) inv ON o.orders_id = inv.orders_id
    WHERE
      ${isNumeric ? `o.orders_id = @q OR o.customers_id = @q OR` : ''}
      o.bs_nr = @q OR
      LOWER(CONCAT(COALESCE(o.delivery_firstname, ''), ' ', COALESCE(o.delivery_lastname, ''))) LIKE LOWER(@name)
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
    LEFT JOIN (
      SELECT DISTINCT products_id, ANY_VALUE(products_image) AS products_image
      FROM ${table(T_PRODUCTS)}
      GROUP BY products_id
    ) p ON i.products_id = p.products_id
    WHERE i.orders_id IN (${placeholders})
  `
  const [itemRows] = await bq.query({ query: itemSql, params: itemParams })

  const itemsByOrder: Record<string, BQItemRow[]> = {}
  for (const item of itemRows as (BQItemRow & { orders_id: string | number })[]) {
    const oid = String(item.orders_id)
    if (!itemsByOrder[oid]) itemsByOrder[oid] = []
    itemsByOrder[oid].push(item)
  }

  // Retoure / Gutschrift pro Produkt — separate resiliente Query
  const retourenByKey: Record<string, string> = {}
  const gutschriftByKey: Record<string, string> = {}
  try {
    const retourenSql = `
      SELECT rp.products_id, inv.orders_id, ANY_VALUE(r.retouren_nr) AS retouren_nr
      FROM ${table(T_RETOUREN_PRODUCTS)} rp
      JOIN ${table(T_RETOUREN)} r ON rp.retouren_id = r.retouren_id
      JOIN ${table(T_INVOICE)} inv ON r.invoice_id = inv.invoice_id
      WHERE inv.orders_id IN (${placeholders})
      GROUP BY rp.products_id, inv.orders_id
    `
    const [retourenRows] = await bq.query({ query: retourenSql, params: itemParams })
    for (const row of retourenRows as { products_id: string; orders_id: string; retouren_nr: string }[]) {
      retourenByKey[`${row.orders_id}:${row.products_id}`] = row.retouren_nr
    }

    const gutschriftSql = `
      SELECT gp.products_id, inv.orders_id, ANY_VALUE(g.gutschrift_nr) AS gutschrift_nr
      FROM ${table(T_GUTSCHRIFT_PRODUCTS)} gp
      JOIN ${table(T_GUTSCHRIFT)} g ON gp.gutschrift_id = g.gutschrift_id
      JOIN ${table(T_INVOICE)} inv ON g.invoice_id = inv.invoice_id
      WHERE inv.orders_id IN (${placeholders})
      GROUP BY gp.products_id, inv.orders_id
    `
    const [gutschriftRows] = await bq.query({ query: gutschriftSql, params: itemParams })
    for (const row of gutschriftRows as { products_id: string; orders_id: string; gutschrift_nr: string }[]) {
      gutschriftByKey[`${row.orders_id}:${row.products_id}`] = row.gutschrift_nr
    }
  } catch (e) {
    console.error('Retouren/Gutschrift lookup failed (non-fatal):', e)
  }

  // Merge retoure/gutschrift into items
  for (const items of Object.values(itemsByOrder)) {
    for (const item of items) {
      const key = `${(item as BQItemRow & { orders_id: string | number }).orders_id ?? ''}:${item.products_id}`
      item.retouren_nr = retourenByKey[key] ?? null
      item.gutschrift_nr = gutschriftByKey[key] ?? null
    }
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
      cust.customers_nr,
      inv.orders_rechnungsdatum
    FROM ${table(T_ORDERS)} o
    LEFT JOIN (
      SELECT customers_id, ANY_VALUE(customers_nr) AS customers_nr
      FROM ${table(T_CUSTOMERS)}
      GROUP BY customers_id
    ) cust ON o.customers_id = cust.customers_id
    LEFT JOIN (
      SELECT orders_id, ANY_VALUE(orders_rechnungsdatum) AS orders_rechnungsdatum
      FROM ${table(T_INVOICE)}
      GROUP BY orders_id
    ) inv ON o.orders_id = inv.orders_id
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
    LEFT JOIN (
      SELECT DISTINCT products_id, ANY_VALUE(products_image) AS products_image
      FROM ${table(T_PRODUCTS)}
      GROUP BY products_id
    ) p ON i.products_id = p.products_id
    WHERE i.orders_id = @id
  `
  const [itemRows] = await bq.query({ query: itemSql, params: { id } })
  const items = itemRows as BQItemRow[]

  // Retoure / Gutschrift — separate resiliente Queries
  const retourenByProduct: Record<string, string> = {}
  const gutschriftByProduct: Record<string, string> = {}
  try {
    const retourenSql = `
      SELECT rp.products_id, ANY_VALUE(r.retouren_nr) AS retouren_nr
      FROM ${table(T_RETOUREN_PRODUCTS)} rp
      JOIN ${table(T_RETOUREN)} r ON rp.retouren_id = r.retouren_id
      JOIN ${table(T_INVOICE)} inv ON r.invoice_id = inv.invoice_id
      WHERE inv.orders_id = @id
      GROUP BY rp.products_id
    `
    const [retourenRows] = await bq.query({ query: retourenSql, params: { id } })
    for (const row of retourenRows as { products_id: string; retouren_nr: string }[]) {
      retourenByProduct[row.products_id] = row.retouren_nr
    }

    const gutschriftSql = `
      SELECT gp.products_id, ANY_VALUE(g.gutschrift_nr) AS gutschrift_nr
      FROM ${table(T_GUTSCHRIFT_PRODUCTS)} gp
      JOIN ${table(T_GUTSCHRIFT)} g ON gp.gutschrift_id = g.gutschrift_id
      JOIN ${table(T_INVOICE)} inv ON g.invoice_id = inv.invoice_id
      WHERE inv.orders_id = @id
      GROUP BY gp.products_id
    `
    const [gutschriftRows] = await bq.query({ query: gutschriftSql, params: { id } })
    for (const row of gutschriftRows as { products_id: string; gutschrift_nr: string }[]) {
      gutschriftByProduct[row.products_id] = row.gutschrift_nr
    }
  } catch (e) {
    console.error('Retouren/Gutschrift lookup failed (non-fatal):', e)
  }

  for (const item of items) {
    const pid = String(item.products_id ?? '')
    item.retouren_nr = retourenByProduct[pid] ?? null
    item.gutschrift_nr = gutschriftByProduct[pid] ?? null
  }

  return mapOrder((rows as BQOrderRow[])[0], items)
}

export function isBigQueryConfigured(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCP_SERVICE_ACCOUNT_JSON
  )
}
