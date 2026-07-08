export type Order = {
  id: string
  orderNumber: string
  date: string
  customerName: string
  customerEmail: string
  customerNumber: string
  invoiceNumber?: string
  invoiceNr?: string
  deliveryNoteNumber?: string
  invoiceDate?: string
  invoiceDateWarning?: boolean
  status: string
  items: OrderItem[]
  // true, wenn die Artikel aus den Bestellpositionen (atlos_orders_products)
  // stammen, weil in BigQuery noch keine Rechnung (invoice_products) vorliegt.
  // Preise/Retouren-Verknüpfungen sind dann noch nicht final.
  notInvoiced?: boolean
  source?: string
  partnershop?: string
  externOrderId?: string
  activeRetourenNr?: string
}

export type OrderItem = {
  id: string
  productId: string
  productName: string
  sku?: string
  quantity: number
  price: number
  imageUrl?: string
  existingRetoure?: string | null
  existingGutschrift?: string | null
  inActiveRetoure?: boolean
}

export type ReturnCondition = 'gut' | 'beschaedigt' | 'unvollstaendig' | 'defekt'
export type ReturnReason =
  | 'gefaellt_nicht'
  | 'falsch_geliefert'
  | 'defekt_bei_ankunft'
  | 'groesse_passt_nicht'
  | 'beschaedigt_bei_lieferung'
  | 'sonstiges'
export type ReturnResolution = 'erstattung' | 'umtausch'

export type ReplacementProduct = {
  productId: string
  name: string
  sku?: string
  ean?: string
}

export type ReturnItemCapture = {
  itemId: string
  returned: boolean
  returnedQuantity: number
  condition: ReturnCondition
  reason: ReturnReason
  resolution: ReturnResolution
  notes: string
  replacementProduct?: ReplacementProduct | null
}

export type ReturnCapture = {
  orderId: string
  order: Order
  items: ReturnItemCapture[]
  packageService: string
  trackingNumber: string
  notes: string
  operatorName: string
  dhlReturn?: boolean
  photos?: Array<{ id: string; type: string; dataUrl: string; name: string }>
}

export type SearchResult = {
  orders: Order[]
  query: string
  mode: 'live' | 'demo'
}
