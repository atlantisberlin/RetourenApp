import { createSessionToken, verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'
import { SessionCreateSchema } from '@/lib/schemas'
import { auditLog } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const body = await request.json()
    const validated = SessionCreateSchema.parse(body)

    const token = await createSessionToken(validated.operatorName)

    auditLog({ event: 'login', status: 'success', operator: validated.operatorName, ip })

    return apiJson(
      successResponse({
        token,
        expiresIn: '24h',
        operatorName: validated.operatorName,
      }),
      200
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      auditLog({ event: 'login', status: 'failure', ip, reason: 'invalid_input' })
      return apiJson(
        errorResponse(`Invalid input: ${error.issues[0]?.message || 'Invalid input'}`),
        400
      )
    }
    console.error('Session creation error:', error)
    auditLog({ event: 'login', status: 'failure', ip, reason: 'server_error' })
    return apiJson(errorResponse('Failed to create session'), 500)
  }
}

/**
 * PUT /api/auth/session
 * Stiller Token-Refresh: verlangt ein NOCH GÜLTIGES Token (kein Neu-Login über
 * den Namen) und stellt dafür ein frisches 24h-Token aus. So läuft die Sitzung
 * eines aktiv arbeitenden Mitarbeiters nicht mitten am Tag ab. Ist das Token
 * bereits abgelaufen, schlägt die Prüfung fehl (401) und der Client führt über
 * seinen 401-Handler zurück zum Mitarbeiter-Login.
 */
export async function PUT(request: Request) {
  const ip = getClientIp(request)
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

  const newToken = await createSessionToken(operatorName)
  auditLog({ event: 'token_refresh', status: 'success', operator: operatorName, ip })

  return apiJson(
    successResponse({
      token: newToken,
      expiresIn: '24h',
      operatorName,
    }),
    200
  )
}

/**
 * DELETE /api/auth/session
 * Logout: JWTs sind zustandslos, es gibt serverseitig nichts zu invalidieren —
 * dieser Aufruf dient nur dem Audit-Log
 */
export async function DELETE(request: Request) {
  const token = extractSessionToken(
    request.headers.get('authorization') ?? undefined,
    request.headers.get('cookie') ?? undefined
  )
  const operatorName = token ? await verifySessionToken(token) : null
  auditLog({ event: 'logout', status: 'success', operator: operatorName ?? undefined })
  return apiJson(successResponse({ message: 'Session cleared' }), 200)
}
