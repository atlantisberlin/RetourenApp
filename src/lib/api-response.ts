/**
 * Standardized API response format
 */

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number }

/**
 * Create a successful API response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

/**
 * Create an error API response
 */
export function errorResponse(error: string, status?: number): ApiResponse<never> {
  return { success: false, error, status }
}

/**
 * Create a JSON response with standardized format
 */
export function apiJson<T>(
  response: ApiResponse<T>,
  httpStatus: number = response.success ? 200 : 400
): Response {
  return Response.json(response, { status: httpStatus })
}
