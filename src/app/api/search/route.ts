import { isBigQueryConfigured, searchOrders } from '@/lib/bigquery'
import { searchDemoOrders } from '@/lib/demo-data'
import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, errorResponse } from '@/lib/api-response'
import { SearchQuerySchema } from '@/lib/schemas'
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
    const validated = SearchQuerySchema.parse({ q })

    if (!validated.q.trim()) {
      return Response.json({ orders: [], query: validated.q, mode: 'demo' })
    }

    if (isBigQueryConfigured()) {
      try {
        const orders = await searchOrders(validated.q)
        return Response.json({ orders, query: validated.q, mode: 'live' })
      } catch (err) {
        console.error('BigQuery search failed:', err)
        return apiJson(errorResponse('Search failed'), 500)
      }
    }

    const orders = searchDemoOrders(validated.q)
    return Response.json({ orders, query: validated.q, mode: 'demo' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiJson(errorResponse(`Invalid input: ${error.issues[0]?.message || 'Invalid input'}`), 400)
    }
    console.error('Search error:', error)
    return apiJson(errorResponse('Search failed'), 500)
  }
}
