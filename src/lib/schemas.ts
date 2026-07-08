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
  returnedQuantity: z.number().int().min(1, 'Quantity must be at least 1'),
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
    .optional(),
})

export const OrderItemSchema = z.object({
  id: z.string(),
  productName: z.string(),
  productId: z.string(),
  sku: z.string().optional(),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
  imageUrl: z.string().url().optional(),
})

export const OrderSchema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string(),
  customerNumber: z.string(),
  customerName: z.string().max(200),
  customerEmail: z.string().email().optional(),
  items: z.array(OrderItemSchema).min(1, 'Order must have items'),
  source: z.string().optional(),
  partnershop: z.string().optional(),
  activeRetourenNr: z.string().optional(),
  invoiceNr: z.string().optional(),
  deliveryNoteNumber: z.string().optional(),
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
