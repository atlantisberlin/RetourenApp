import { NextRequest, NextResponse } from 'next/server'
import { verifyDeviceToken, DEVICE_TOKEN_COOKIE } from '@/lib/device-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit-log'

// Einzige Wege, die ohne Geräte-Cookie erreichbar sein müssen: die
// Code-Eingabeseite selbst und die Route, die den Code prüft
const PUBLIC_PATHS = ['/geraet-anmelden', '/api/auth/device']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// Pfad-Präfix -> Limit pro IP. Erster Treffer gewinnt, sonst DEFAULT_API_LIMIT.
// /api/auth/device bekommt das strengste Limit: der Geräte-Code ist ein
// geteiltes Geheimnis ohne eigenes Rate-Limiting am Vergleich selbst (siehe
// safeCompare in der Route) — das Erraten muss hier gebremst werden.
const RATE_LIMITS: { prefix: string; limit: number; windowMs: number }[] = [
  { prefix: '/api/auth/device', limit: 10, windowMs: 15 * 60_000 },
  { prefix: '/api/auth/session', limit: 20, windowMs: 60_000 },
  { prefix: '/api/search-products', limit: 60, windowMs: 60_000 },
  { prefix: '/api/search', limit: 60, windowMs: 60_000 },
  { prefix: '/api/submit', limit: 20, windowMs: 60_000 },
  { prefix: '/api/undelivered', limit: 20, windowMs: 60_000 },
  { prefix: '/api/versand', limit: 20, windowMs: 60_000 },
  { prefix: '/api/attach-photo', limit: 20, windowMs: 60_000 },
]
const DEFAULT_API_LIMIT = { limit: 60, windowMs: 60_000 }

function getRateLimitConfig(pathname: string): { limit: number; windowMs: number } {
  const match = RATE_LIMITS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))
  return match ?? DEFAULT_API_LIMIT
}

// Nonce-basierte CSP: pro Anfrage neu zufällig erzeugt. Next.js hängt dieses
// Nonce automatisch an seine eigenen (für Hydration/Streaming nötigen)
// Inline-Skripte an, sobald es das Nonce im CSP-Header erkennt — jedes
// FREMDE Inline-Skript (z. B. über eine XSS-Lücke eingeschleust) hat dieses
// Nonce nicht und bleibt weiterhin blockiert.
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isProd ? '' : " 'unsafe-eval' 'unsafe-inline'"}`,
    // style-src braucht 'unsafe-inline', weil die App durchgängig React-
    // Inline-Styles (style={{...}}) statt CSS-Klassen nutzt.
    "style-src 'self' 'unsafe-inline'",
    // data: für aufgenommene Fotos (Base64-Vorschau vor dem Asana-Upload)
    "img-src 'self' data: https://www.atlantiscloud.de",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // HTTPS erzwingen (Defense-in-Depth — Vercel/Coolify-Traefik machen das
  // i.d.R. schon auf Proxy-Ebene, schadet aber nicht, es zusätzlich hier zu
  // prüfen). x-forwarded-proto fehlt in lokaler Entwicklung meist komplett,
  // daher greift dieser Block dort ohnehin nicht.
  const proto = request.headers.get('x-forwarded-proto')
  if (process.env.NODE_ENV === 'production' && proto === 'http') {
    const httpsUrl = new URL(request.url)
    httpsUrl.protocol = 'https:'
    return NextResponse.redirect(httpsUrl, 308)
  }

  const ip = getClientIp(request)

  if (pathname.startsWith('/api/')) {
    const { limit, windowMs } = getRateLimitConfig(pathname)
    const result = checkRateLimit(`${ip}:${pathname}`, limit, windowMs)
    if (!result.allowed) {
      auditLog({ event: 'rate_limit', status: 'failure', ip, path: pathname })
      return NextResponse.json(
        { error: 'Zu viele Anfragen, bitte kurz warten.' },
        { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
      )
    }
  }

  // Nonce + CSP frisch pro Anfrage — nur für Antworten nötig, die tatsächlich
  // eine Seite rendern (Next.js hängt das Nonce automatisch an seine eigenen
  // Skripte, sobald es im CSP-Header erkennbar ist)
  const nonce = crypto.randomUUID()
  const csp = buildCsp(nonce)
  function nextWithCsp(): NextResponse {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  if (isPublicPath(pathname)) {
    return nextWithCsp()
  }

  const token = request.cookies.get(DEVICE_TOKEN_COOKIE)?.value
  const authorized = await verifyDeviceToken(token)

  if (authorized) {
    return nextWithCsp()
  }

  if (pathname.startsWith('/api/')) {
    auditLog({ event: 'device_gate', status: 'failure', ip, path: pathname })
    return NextResponse.json({ error: 'Gerät nicht autorisiert' }, { status: 401 })
  }

  const loginUrl = new URL('/geraet-anmelden', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Alles außer Next-interne Assets und Dateien mit Endung (Icons, manifest.json, favicon …)
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
}
