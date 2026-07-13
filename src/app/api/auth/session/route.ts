import { createSessionToken } from '@/lib/session'
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
 * DELETE /api/auth/session
 * Logout: clear session token
 */
export async function DELETE() {
  return apiJson(successResponse({ message: 'Session cleared' }), 200)
}
