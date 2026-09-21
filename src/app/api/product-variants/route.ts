import { getProductSiblings } from '@/lib/bigquery'
import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, errorResponse } from '@/lib/api-response'
import { ProductVariantsQuerySchema } from '@/lib/schemas'
import { z } from 'zod'

export async function GET(request: Request) {
  const token = extractSessionToken(
    request.headers.get('authorization') ?? undefined,
    request.headers.get('cookie') ?? undefined
  )

  if (!token) {
    return apiJson(errorResponse('Unauthorized: No session token'), 401)
  }

  const operatorName = await verifySessionToken(token)
  if (!operatorName) {
    return apiJson(errorResponse('Unauthorized: Invalid or expired session'), 401)
  }

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId') ?? ''
  const model = searchParams.get('model') ?? ''

  try {
    const validated = ProductVariantsQuerySchema.parse({ productId, model })
    const result = await getProductSiblings({ productId: validated.productId, model: validated.model })
    return Response.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiJson(errorResponse(`Invalid input: ${error.issues[0]?.message || 'Invalid input'}`), 400)
    }
    console.error('getProductSiblings error:', error)
    return apiJson(errorResponse('Variantensuche fehlgeschlagen'), 500)
  }
}
