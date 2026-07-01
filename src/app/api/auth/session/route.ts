import { createSessionToken, getSessionCookieHeader } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'

/**
 * POST /api/auth/session
 * Create a new session token for an operator
 *
 * Request body: { operatorName: string }
 * Response: { success: true, data: { token: string, expiresIn: string, operatorName: string } }
 */
export async function POST(request: Request) {
  try {
    const { operatorName } = (await request.json()) as { operatorName?: string }

    if (!operatorName?.trim()) {
      return apiJson(errorResponse('Operator name is required'), 400)
    }

    const token = await createSessionToken(operatorName)

    return apiJson(
      successResponse({
        token,
        expiresIn: '24h',
        operatorName: operatorName.trim(),
      }),
      200
    )
  } catch (error) {
    console.error('Session creation error:', error)
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
