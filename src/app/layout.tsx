import type { Metadata, Viewport } from 'next'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* TEMPORÄR zur Fehlersuche (Tablet reagiert nicht auf Eingaben) —
            danach wieder entfernen, siehe public/diagnostic.js */}
        <script src="/diagnostic.js" />
      </head>
      <body className="app-shell">
        <HydrationMarker />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
