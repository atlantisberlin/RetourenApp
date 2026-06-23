export type Order = {
  id: string
  orderNumber: string
  date: string
  customerName: string
  customerEmail: string
  customerNumber: string
  invoiceNumber?: string
  deliveryNoteNumber?: string
  status: string
  items: OrderItem[]
  source?: string
}

export type OrderItem = {
  id: string
  productId: string
  productName: string
  sku?: string
  quantity: number
  price: number
  imageUrl?: string
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

export type ReturnItemCapture = {
  itemId: string
  returned: boolean
  returnedQuantity: number
  condition: ReturnCondition
  reason: ReturnReason
  resolution: ReturnResolution
  notes: string
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
