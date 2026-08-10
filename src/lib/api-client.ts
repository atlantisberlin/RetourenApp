import { getSessionToken } from './client-session'
import { clearOperator } from './operator'
import type { ApiResponse } from './api-response'

/**
 * Reagiert auf abgelaufene/ungültige Sitzungen (HTTP 401). Das JWT-Token läuft
 * nach 24 h ab, während die Oberfläche einen Mitarbeiter bei Aktivität beliebig
 * lange „angemeldet" hält — dadurch kann das Token mitten in der Arbeit ablaufen,
 * ohne dass die App es bemerkt. Statt den Fehler still zu schlucken, melden wir
 * hier den Mitarbeiter ab und schicken ihn zurück zum Login.
 */
let redirectingToLogin = false
function handleUnauthorized(): void {
  if (typeof window === 'undefined') return
  // Getippte Suche (Debounce) feuert 401 im Sekundentakt — nur EINMAL abmelden.
  if (redirectingToLogin) return
  redirectingToLogin = true
  // Verwirft Mitarbeiter-Namen UND das (abgelaufene) JWT-Token.
  clearOperator()
  // Harte Navigation, damit der Ziel-Screen frisch mountet und den nun leeren
  // Operator neu einliest -> „Wer nimmt heute an?"-Login erscheint automatisch.
  // /retouren zeigt den Login inline und stellt den Entwurf danach wieder her;
  // alle anderen Seiten führen zurück zur Startseite.
  const target = window.location.pathname === '/retouren' ? '/retouren' : '/'
  window.location.assign(target)
}

/**
 * Fetch wrapper that automatically includes JWT token in Authorization header
 */
export async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = getSessionToken()

  const headers = new Headers(options?.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized()
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(
      (typeof errorData.error === 'string' ? errorData.error : null) || `API error: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<ApiResponse<T>>
}

/**
 * Helper for POST requests with token
 */
export async function apiPost<T>(
  url: string,
  data: unknown,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...options,
  })
}

/**
 * Helper for DELETE requests with token
 */
export async function apiDelete<T>(
  url: string,
  options?: Omit<RequestInit, 'method'>
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    method: 'DELETE',
    ...options,
  })
}

/**
 * Helper for GET requests with token.
 * Returns the raw parsed JSON — endpoints like /api/search respond with a
 * bare object ({ orders, query, mode }), not the ApiResponse envelope.
 */
export async function apiGet<T>(
  url: string,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<T> {
  const token = getSessionToken()

  const headers = new Headers(options?.headers || {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, { ...options, method: 'GET', headers })

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized()
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(
      (typeof errorData.error === 'string' ? errorData.error : null) || `API error: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<T>
}
