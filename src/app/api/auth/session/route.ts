import { createSessionToken } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'
import { SessionCreateSchema } from '@/lib/schemas'
import { z } from 'zod'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = SessionCreateSchema.parse(body)

    const token = await createSessionToken(validated.operatorName)

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
      return apiJson(
        errorResponse(`Invalid input: ${error.issues[0]?.message || 'Invalid input'}`),
        400
      )
    }
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
