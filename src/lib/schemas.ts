import { z } from 'zod'

export const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Search query required')
    .max(100, 'Search query too long (max 100 chars)')
    .trim(),
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
  id: z.string(),
  productName: z.string(),
  productId: z.string(),
  sku: z.string().nullish(),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
  // BigQuery liefert für fehlende Felder null; imageUrl kann zudem
  // Dateinamen mit Leer-/Sonderzeichen enthalten, daher kein strenges url()
  imageUrl: z.string().nullish(),
})

export const OrderSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string(),
  customerNumber: z.string(),
  customerName: z.string().max(200),
  // leerer String, wenn im Shop keine E-Mail hinterlegt ist; null aus BQ
  customerEmail: z.union([z.string().email(), z.literal('')]).nullish(),
  items: z.array(OrderItemSchema).min(1, 'Order must have items'),
  source: z.string().nullish(),
  partnershop: z.string().nullish(),
  activeRetourenNr: z.string().nullish(),
  // null, solange (noch) keine Rechnung in BigQuery vorliegt
  invoiceNr: z.string().nullish(),
  deliveryNoteNumber: z.string().nullish(),
})

export const PhotoSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string().max(200),
  dataUrl: z.string().startsWith('data:image/', 'Invalid image data format'),
})

export const ReturnCaptureSchema = z.object({
  orderId: z.string().min(1, 'Order ID required'),
  order: OrderSchema,
  items: z.array(ReturnItemSchema).min(1, 'At least one item required'),
  photos: z.array(PhotoSchema).max(20, 'Maximum 20 photos allowed').optional(),
  trackingNumber: z.string().max(100).optional(),
  dhlReturn: z.boolean().optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
})

export const VersandPhotoSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string().max(200),
  dataUrl: z.string().startsWith('data:image/', 'Invalid image data format'),
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
  photos: z.array(VersandPhotoSchema).max(20, 'Maximum 20 photos allowed').optional(),
})

export const OrderDetailQuerySchema = z.object({
  id: z.string().min(1, 'Order ID required').max(100),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>
export type SessionCreate = z.infer<typeof SessionCreateSchema>
export type ReturnCapture = z.infer<typeof ReturnCaptureSchema>
export type Versand = z.infer<typeof VersandSchema>
export type OrderDetailQuery = z.infer<typeof OrderDetailQuerySchema>
