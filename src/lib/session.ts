import { SignJWT, jwtVerify } from 'jose'

let _secret: Uint8Array | null = null
let _secretWarningShown = false

function initSecret(): Uint8Array {
  if (_secret) return _secret

  const envSecret = process.env.JWT_SECRET

  let secretValue: string
  if (envSecret) {
    secretValue = envSecret
  } else {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is not set.\n' +
        'This is required for production. Set a 32+ character random string:\n' +
        '  export JWT_SECRET=$(openssl rand -hex 32)\n' +
        'Or generate via:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        'See README.md for more details.'
      )
    }

    if (!_secretWarningShown && !process.env.SUPPRESS_DEV_SECRET_WARNING) {
      console.warn(
        '⚠️  JWT_SECRET not set. Using static dev secret.\n' +
        '   This is OK for development only.\n' +
        '   For production, ALWAYS set JWT_SECRET env var to a secure random value.'
      )
      _secretWarningShown = true
    }
    secretValue = 'dev-only-insecure-key-change-for-production-32char'
  }

  _secret = new TextEncoder().encode(secretValue)
  return _secret
}

function getSecret(): Uint8Array {
  return initSecret()
}

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
    .sign(getSecret())

  return token
}

/**
 * Verify and decode a JWT token
 * Returns operator name if valid, null otherwise
 */
export async function verifySessionToken(token: string): Promise<string | null> {
  if (!token) return null

  try {
    const verified = await jwtVerify(token, getSecret())
    const payload = verified.payload as unknown as SessionPayload

    if (!payload.operator) return null
    return payload.operator
  } catch {
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
