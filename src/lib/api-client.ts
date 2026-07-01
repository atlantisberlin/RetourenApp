import { getSessionToken } from './client-session'

/**
 * Fetch wrapper that automatically includes JWT token in Authorization header
 */
export async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
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
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.error || `API error: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<T>
}

/**
 * Helper for POST requests with token
 */
export async function apiPost<T>(
  url: string,
  data: unknown,
  options?: Omit<RequestInit, 'method' | 'body'>
): Promise<T> {
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
): Promise<T> {
  return apiCall<T>(url, {
    method: 'DELETE',
    ...options,
  })
}
