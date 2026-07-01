import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
const secret = new TextEncoder().encode(JWT_SECRET)

export const SESSION_TOKEN_COOKIE = 'retouren_session'
export const SESSION_EXPIRY = '24h'

export interface SessionPayload {
  operator: string
  iat: number
}

/**
 * Create a signed JWT token for a session
 * Token expires after 24 hours
 */
export async function createSessionToken(operatorName: string): Promise<string> {
  if (!operatorName?.trim()) {
    throw new Error('Operator name is required')
  }

  const token = await new SignJWT({
    operator: operatorName.trim(),
    iat: Math.floor(Date.now() / 1000),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(SESSION_EXPIRY)
    .sign(secret)

  return token
}

/**
 * Verify and decode a JWT token
 * Returns operator name if valid, null otherwise
 */
export async function verifySessionToken(token: string): Promise<string | null> {
  if (!token) return null

  try {
    const verified = await jwtVerify(token, secret)
    const payload = verified.payload as unknown as SessionPayload

    if (!payload.operator) return null
    return payload.operator
  } catch (error) {
    // Token is invalid or expired
    return null
  }
}

/**
 * Extract token from Authorization header (Bearer token)
 * or from cookies
 */
export function extractSessionToken(
  authHeader?: string,
  cookies?: string
): string | null {
  // Try Authorization header first
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Try to extract from cookies
  if (cookies) {
    const match = cookies.match(
      new RegExp(`(?:^|; )${SESSION_TOKEN_COOKIE}=([^;]*)`)
    )
    if (match) return match[1]
  }

  return null
}

/**
 * Helper to set secure session cookie headers
 * Use in API responses
 */
export function getSessionCookieHeader(token: string): string {
  return `${SESSION_TOKEN_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
}

/**
 * Helper to clear session cookie
 */
export function getClearSessionCookieHeader(): string {
  return `${SESSION_TOKEN_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}
