import { SignJWT, jwtVerify } from 'jose'
import { getSecret } from './session'

export const DEVICE_TOKEN_COOKIE = 'retouren_device'
const DEVICE_TOKEN_EXPIRY = '365d'
const DEVICE_TOKEN_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Device tokens carry no operator identity, only `typ: 'device'`. This keeps
 * them non-interchangeable with operator session tokens even though both are
 * signed with the same secret (session tokens require `operator` to verify).
 */
export async function createDeviceToken(): Promise<string> {
  return await new SignJWT({ typ: 'device' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(DEVICE_TOKEN_EXPIRY)
    .sign(getSecret())
}

export async function verifyDeviceToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload.typ === 'device'
  } catch {
    return false
  }
}

export function getDeviceCookieHeader(token: string): string {
  return `${DEVICE_TOKEN_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${DEVICE_TOKEN_MAX_AGE}`
}
