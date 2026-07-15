import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production'

// Content-Security-Policy wird NICHT hier gesetzt, sondern pro Anfrage in
// middleware.ts — sie braucht ein zufälliges Nonce, damit Next.js' eigene
// (für Hydration/Streaming nötige) Inline-Skripte laufen dürfen, ohne
// Inline-Skripte pauschal zu erlauben. Ein hier zusätzlich gesetzter
// statischer CSP-Header ohne Nonce würde sich mit dem aus der Middleware
// überschneiden und dessen Nonce-Erlaubnis wieder aufheben (Browser wenden
// mehrere CSP-Header als Schnittmenge an).
const securityHeaders = [
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
