import { createSessionToken, getSessionCookieHeader } from '@/lib/session'

/**
 * POST /api/auth/session
 * Create a new session token for an operator
 *
 * Request body: { operatorName: string }
 * Response: { token: string, expiresIn: string }
 */
export async function POST(request: Request) {
  try {
    const { operatorName } = (await request.json()) as { operatorName?: string }

    if (!operatorName?.trim()) {
      return Response.json(
        { error: 'Operator name is required', status: 400 },
        { status: 400 }
      )
    }

    const token = await createSessionToken(operatorName)

    return Response.json(
      {
        token,
        expiresIn: '24h',
        operatorName: operatorName.trim(),
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': getSessionCookieHeader(token),
        },
      }
    )
  } catch (error) {
    console.error('Session creation error:', error)
    return Response.json(
      { error: 'Failed to create session', status: 500 },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/session
 * Logout: clear session token
 */
export async function DELETE() {
  return Response.json(
    { success: true, message: 'Session cleared' },
    {
      status: 200,
      headers: {
        'Set-Cookie': 'retouren_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      },
    }
  )
}
