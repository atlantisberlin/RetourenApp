/**
 * Client-side session management
 * Handles JWT token storage and retrieval
 */

const SESSION_TOKEN_KEY = 'retouren_session_token'

export async function createSession(operatorName: string): Promise<string> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatorName }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`)
    }

    const data = (await response.json()) as {
      token: string
      expiresIn: string
      operatorName: string
    }

    // Store token in localStorage
    localStorage.setItem(SESSION_TOKEN_KEY, data.token)

    return data.token
  } catch (error) {
    console.error('Session creation failed:', error)
    throw error
  }
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_TOKEN_KEY)
  // Also call logout API to clear server-side session
  fetch('/api/auth/session', { method: 'DELETE' }).catch(console.error)
}

export function hasSession(): boolean {
  return getSessionToken() !== null
}
