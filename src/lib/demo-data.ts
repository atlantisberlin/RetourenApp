import type { Order } from './types'

export const DEMO_ORDERS: Order[] = [
  {
    id: '100421',
    orderNumber: '100421',
    date: '12.06.2026',
    customerName: 'Klaus Berger',
    customerEmail: 'k.berger@example.de',
    customerNumber: 'KD-4421',
    invoiceNumber: 'RE-2026-100421',
    deliveryNoteNumber: 'LS-100421',
    status: '3',
    source: 'Zentrallager',
    items: [
      {
        id: 'p1',
        productId: 'ART-8821',
        productName: 'Taucheranzug Neopren 5mm Größe L',
        sku: 'TZ-NEO-5MM-L',
        quantity: 1,
        price: 189.0,
      },
      {
        id: 'p2',
        productId: 'ART-4410',
        productName: 'Taucherflossen Profi Set Größe 43',
        sku: 'FL-PRO-43',
        quantity: 1,
        price: 74.5,
      },
      {
        id: 'p3',
        productId: 'ART-2203',
        productName: 'Unterwasser-Taschenlampe LED 1000lm',
        sku: 'UW-LED-1000',
        quantity: 2,
        price: 39.9,
      },
    ],
  },
  {
    id: '100398',
    orderNumber: '100398',
    date: '08.06.2026',
    customerName: 'Sabine Hoffmann',
    customerEmail: 's.hoffmann@example.de',
    customerNumber: 'KD-3812',
    invoiceNumber: 'RE-2026-100398',
    status: '3',
    source: 'Zentrallager',
    items: [
      {
        id: 'p4',
        productId: 'ART-9930',
        productName: 'Schnorchel-Set Erwachsene Classic',
        sku: 'SCHN-CLASS-M',
        quantity: 1,
        price: 45.0,
      },
      {
        id: 'p5',
        productId: 'ART-1144',
        productName: 'Tauchmaske Wide View Silikon schwarz',
        sku: 'MASK-WV-SW',
        quantity: 1,
        price: 62.0,
      },
    ],
  },
  {
    id: '100371',
    orderNumber: '100371',
    date: '03.06.2026',
    customerName: 'Thomas Krause',
    customerEmail: 't.krause@example.de',
    customerNumber: 'KD-5501',
    invoiceNumber: 'RE-2026-100371',
    deliveryNoteNumber: 'LS-100371',
    status: '3',
    source: 'Zentrallager',
    items: [
      {
        id: 'p6',
        productId: 'ART-7720',
        productName: 'BCD Jacket Atlantis Pro M',
        sku: 'BCD-ATL-PRO-M',
        quantity: 1,
        price: 449.0,
      },
    ],
  },
  {
    id: '100355',
    orderNumber: '100355',
    date: '28.05.2026',
    customerName: 'Maria Wagner',
    customerEmail: 'm.wagner@example.de',
    customerNumber: 'KD-2290',
    invoiceNumber: 'RE-2026-100355',
    status: '3',
    source: 'Zentrallager',
    items: [
      {
        id: 'p7',
        productId: 'ART-3310',
        productName: 'Regler Set Einsteiger komplett',
        sku: 'REG-EINST-SET',
        quantity: 1,
        price: 299.0,
      },
      {
        id: 'p8',
        productId: 'ART-5520',
        productName: 'Computertafel Deco 2500',
        sku: 'COMP-DECO-2500',
        quantity: 1,
        price: 189.0,
      },
    ],
  },
]

export function searchDemoOrders(query: string): Order[] {
  const q = query.trim().toLowerCase()
  if (!q) return DEMO_ORDERS.slice(0, 5)
  return DEMO_ORDERS.filter(
    (o) =>
      o.orderNumber.includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerNumber.toLowerCase().includes(q) ||
      o.invoiceNumber?.toLowerCase().includes(q) ||
      o.items.some((i) => i.productName.toLowerCase().includes(q))
  )
}

export function getDemoOrder(id: string): Order | undefined {
  return DEMO_ORDERS.find((o) => o.id === id)
}
