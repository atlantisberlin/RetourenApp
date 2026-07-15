import { searchProducts } from '@/lib/bigquery'
import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, errorResponse } from '@/lib/api-response'
import { ProductSearchQuerySchema } from '@/lib/schemas'
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
  const q = searchParams.get('q') ?? ''

  try {
    const validated = ProductSearchQuerySchema.parse({ q })

    if (validated.q.trim().length < 2) {
      return Response.json({ products: [] })
    }

    const products = await searchProducts(validated.q)
    return Response.json({ products })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiJson(errorResponse(`Invalid input: ${error.issues[0]?.message || 'Invalid input'}`), 400)
    }
    console.error('searchProducts error:', error)
    return apiJson(errorResponse('Suche fehlgeschlagen'), 500)
  }
}
