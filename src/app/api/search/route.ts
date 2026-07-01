import { isBigQueryConfigured, searchOrders } from '@/lib/bigquery'
import { searchDemoOrders } from '@/lib/demo-data'
import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, errorResponse } from '@/lib/api-response'

export async function GET(request: Request) {
  // ✅ AUTHENTIFIZIERUNG HINZUGEFÜGT
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

  if (!q.trim()) {
    return Response.json({ orders: [], query: q, mode: 'demo' })
  }

  if (isBigQueryConfigured()) {
    try {
      const orders = await searchOrders(q)
      return Response.json({ orders, query: q, mode: 'live' })
    } catch (err) {
      console.error('BigQuery search failed:', err)
      return apiJson(errorResponse('Search failed'), 500)
    }
  }

  const orders = searchDemoOrders(q)
  return Response.json({ orders, query: q, mode: 'demo' })
}
