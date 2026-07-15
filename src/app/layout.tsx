import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { HydrationMarker } from '@/components/HydrationMarker'
import './globals.css'

export const metadata: Metadata = {
  title: 'Atlantis Intern',
  description: 'Retouren erfassen und Versand dokumentieren',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Atlantis',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2f6bd6',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Liest das Nonce aus middleware.ts. Der eigentliche Zweck hier ist nicht
  // nur der Wert selbst, sondern DASS headers() aufgerufen wird: das zwingt
  // Next.js, diese Seite bei jeder Anfrage neu (dynamisch) zu rendern statt
  // sie einmalig beim Build statisch zu erzeugen — nur dann bekommen Next.js'
  // eigene Inline-Skripte pro Anfrage ein frisches, gültiges Nonce eingebettet.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="de">
      <head>
        {/* TEMPORÄR zur Fehlersuche (Tablet reagiert nicht auf Eingaben) —
            danach wieder entfernen, siehe public/diagnostic.js */}
        <script src="/diagnostic.js" nonce={nonce} />
      </head>
      <body className="app-shell">
        <HydrationMarker />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
