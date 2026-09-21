import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, errorResponse } from '@/lib/api-response'
import { fetchRetourenBacklog, isAsanaHistoryConfigured } from '@/lib/asana-history'

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

  if (!isAsanaHistoryConfigured()) {
    return Response.json({ entries: [], configured: false })
  }

  try {
    const entries = await fetchRetourenBacklog()
    return Response.json({ entries, configured: true })
  } catch (err) {
    console.error('Backlog fetch failed:', err)
    return apiJson(errorResponse('Rückstand konnte nicht geladen werden'), 500)
  }
}
