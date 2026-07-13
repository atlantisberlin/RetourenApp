import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production'

// script-src braucht 'unsafe-eval'/'unsafe-inline' nur für Next.js' eigenen
// Dev-Server (Fast Refresh/Source Maps) — in Produktion strikt weglassen.
// style-src braucht 'unsafe-inline', weil die App durchgängig React-Inline-
// Styles (style={{...}}) statt CSS-Klassen nutzt.
const csp = [
  "default-src 'self'",
  `script-src 'self'${isProd ? '' : " 'unsafe-eval' 'unsafe-inline'"}`,
  "style-src 'self' 'unsafe-inline'",
  // data: für aufgenommene Fotos (Base64-Vorschau vor dem Asana-Upload)
  "img-src 'self' data: https://www.atlantiscloud.de https://images.unsplash.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 0 statt "1; mode=block": der alte XSS-Auditor-Modus hatte selbst
  // ausnutzbare Lücken und wurde deshalb in modernen Browsern entfernt/
  // deaktiviert — OWASP empfiehlt inzwischen, ihn explizit abzuschalten
  // und sich stattdessen auf die CSP zu verlassen.
  { key: 'X-XSS-Protection', value: '0' },
]

if (isProd) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  })
}

const nextConfig: NextConfig = {
  // Schlankes, eigenständiges Server-Bundle für Docker-Deploys (Coolify o.ä.)
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.atlantiscloud.de',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
