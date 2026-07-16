import { z } from 'zod'

export const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Search query required')
    .max(100, 'Search query too long (max 100 chars)')
    .trim(),
})

export const DeviceCodeSchema = z.object({
  code: z
    .string()
    .min(1, 'Code required')
    .max(100, 'Code too long'),
})

export const SessionCreateSchema = z.object({
  operatorName: z
    .string()
    .min(1, 'Operator name required')
    .max(100, 'Operator name too long')
    .regex(/^[a-zA-Z0-9äöüßÄÖÜ\s\-]+$/, 'Invalid characters in operator name'),
})

export const ReturnItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID required'),
  returned: z.boolean(),
  returnedQuantity: z.number().int().min(0, 'Quantity must be zero or more'),
  condition: z.enum(['gut', 'beschaedigt', 'unvollstaendig', 'defekt'], {
    error: 'Invalid condition',
  }),
  reason: z.enum(
    ['gefaellt_nicht', 'falsch_geliefert', 'defekt_bei_ankunft', 'groesse_passt_nicht', 'beschaedigt_bei_lieferung', 'sonstiges'],
    { error: 'Invalid reason' }
  ),
  resolution: z.enum(['erstattung', 'umtausch'], {
    error: 'Invalid resolution',
  }),
  notes: z.string().max(500, 'Notes too long').optional(),
  replacementProduct: z
    .object({
      name: z.string().max(200),
      sku: z.string().max(50).optional(),
    })
    .nullish(),
})

export const OrderItemSchema = z.object({
  id: z.string().max(50),
  productName: z.string().max(300),
  productId: z.string().max(50),
  sku: z.string().max(100).nullish(),
  quantity: z.number().int().min(1),
  // Kein .min(0): BigQuery liefert für Rabatt-/Gutschrift-Positionen
  // negative final_price-Werte — das ist gültige Bestelldaten, kein Fehler
  price: z.number(),
  // BigQuery liefert für fehlende Felder null; imageUrl kann zudem
  // Dateinamen mit Leer-/Sonderzeichen enthalten, daher kein strenges url()
  imageUrl: z.string().max(500).nullish(),
  // Ohne diese Felder würde Zod sie beim Parsen stillschweigend verwerfen —
  // das war der Grund, warum eine bereits vom Kunden angelegte Retourennummer
  // nie bei der Asana-Übergabe ankam, obwohl die App sie korrekt anzeigt.
  existingRetoure: z.string().max(50).nullish(),
})

export const OrderSchema = z.object({
  id: z.string().min(1).max(50),
  orderNumber: z.string().max(50),
  customerNumber: z.string().max(50),
  customerName: z.string().max(200),
  // leerer String, wenn im Shop keine E-Mail hinterlegt ist; null aus BQ
  customerEmail: z.union([z.string().email(), z.literal('')]).nullish(),
  // 200 Artikel deckt jede realistische Bestellung ab und begrenzt die
  // Größe des wieder eingereichten Bestell-Objekts
  items: z.array(OrderItemSchema).min(1, 'Order must have items').max(200),
  source: z.string().max(100).nullish(),
  partnershop: z.string().max(50).nullish(),
  // null, solange (noch) keine Rechnung in BigQuery vorliegt
  invoiceNr: z.string().max(50).nullish(),
  deliveryNoteNumber: z.string().max(50).nullish(),
  invoiceDate: z.string().max(50).nullish(),
  invoiceDateWarning: z.boolean().nullish(),
  invoiceDateDays: z.number().nullish(),
})

export const ReturnCaptureSchema = z.object({
  orderId: z.string().min(1, 'Order ID required'),
  order: OrderSchema,
  items: z.array(ReturnItemSchema).min(1, 'At least one item required'),
  trackingNumber: z.string().max(100).optional(),
  dhlReturn: z.boolean().optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
})

export const VersandSchema = z.object({
  carrier: z.string().max(100).optional(),
  trackingNumber: z
    .string()
    .min(1, 'Tracking number required')
    .max(100, 'Tracking number too long'),
  deliveryNote: z.string().max(100).optional(),
  insuranceValue: z.string().max(50).optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
})

export const UndeliveredCaptureSchema = z.object({
  orderId: z.string().min(1, 'Order ID required'),
  order: OrderSchema,
  reason: z.enum(['annahme_verweigert', 'nicht_abgeholt', 'empfaenger_unbekannt', 'sonstiges'], {
    error: 'Invalid reason',
  }),
  notes: z.string().max(1000, 'Notes too long').optional(),
})

export const ProductSearchQuerySchema = z.object({
  q: z.string().max(100, 'Search query too long (max 100 chars)'),
})
