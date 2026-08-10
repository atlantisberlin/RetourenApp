/**
 * Client-side session management
 * Handles JWT token storage and retrieval
 */

const SESSION_TOKEN_KEY = 'retouren_session_token'
const OPERATOR_NAME_KEY = 'operator_name'
const OPERATOR_TS_KEY = 'operator_ts'

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

    const response_data = (await response.json()) as {
      success: boolean
      data?: { token: string; expiresIn: string; operatorName: string }
      error?: string
    }

    if (!response_data.success || !response_data.data) {
      throw new Error(response_data.error || 'Failed to create session')
    }

    // Store token in localStorage
    localStorage.setItem(SESSION_TOKEN_KEY, response_data.data.token)

    // Also store operator name for getOperator() compatibility
    localStorage.setItem(OPERATOR_NAME_KEY, response_data.data.operatorName)
    localStorage.setItem(OPERATOR_TS_KEY, String(Date.now()))

    return response_data.data.token
  } catch (error) {
    console.error('Session creation failed:', error)
    throw error
  }
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

/**
 * Liest das Ablaufdatum (exp, Sekunden seit Epoch) aus dem JWT — ohne
 * Signaturprüfung, die reine Base64-Payload genügt, um clientseitig zu
 * entscheiden, wann still erneuert werden muss. Gibt null zurück, wenn kein
 * Token vorliegt oder es sich nicht dekodieren lässt.
 */
export function getSessionExpiry(): number | null {
  const token = getSessionToken()
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    // Base64url -> Base64 inkl. Padding, sonst scheitert atob je nach Länge.
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = JSON.parse(atob(padded)) as { exp?: number }
    return typeof json.exp === 'number' ? json.exp : null
  } catch {
    return null
  }
}

/**
 * Erneuert das JWT still im Hintergrund (PUT /api/auth/session). Der Server
 * leitet den Mitarbeiter aus dem noch gültigen Token ab und stellt ein frisches
 * 24h-Token aus.
 *
 * WICHTIG: aktualisiert bewusst NICHT operator_ts — der 10-Minuten-Idle-Logout
 * (siehe operator.ts) muss unabhängig vom Token-Refresh weiterlaufen, sonst
 * würde der Hintergrund-Timer einen inaktiven Mitarbeiter dauerhaft angemeldet
 * halten. Gibt true bei Erfolg zurück, sonst false (Aufrufer entscheidet).
 */
export async function refreshSession(): Promise<boolean> {
  const token = getSessionToken()
  if (!token) return false
  try {
    const response = await fetch('/api/auth/session', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return false
    const data = (await response.json()) as {
      success: boolean
      data?: { token: string }
    }
    if (!data.success || !data.data?.token) return false
    localStorage.setItem(SESSION_TOKEN_KEY, data.data.token)
    return true
  } catch {
    return false
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  const token = getSessionToken()
  localStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(OPERATOR_NAME_KEY)
  localStorage.removeItem(OPERATOR_TS_KEY)
  // Nur fürs Audit-Log (JWTs sind zustandslos, es gibt serverseitig nichts
  // zu invalidieren) — Token mitschicken, damit der Logout dem Mitarbeiter
  // zugeordnet werden kann
  fetch('/api/auth/session', {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(console.error)
}

export function hasSession(): boolean {
  return getSessionToken() !== null
}
