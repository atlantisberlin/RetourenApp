import { getSessionToken } from './client-session'
import type { ApiResponse } from './api-response'

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
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(
      (typeof errorData.error === 'string' ? errorData.error : null) || `API error: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<T>
}
