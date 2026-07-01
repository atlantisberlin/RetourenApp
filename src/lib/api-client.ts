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
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      (errorData as any).error || `API error: ${response.status} ${response.statusText}`
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
