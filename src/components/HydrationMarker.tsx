'use client'

import { useEffect } from 'react'

// Temporäre Diagnose-Hilfe: setzt ein Attribut, sobald React tatsächlich im
// Browser gestartet ist (useEffect läuft nur nach erfolgreicher Hydration).
// Wird von public/diagnostic.js ausgelesen, um "React startet lautlos nicht"
// von anderen Fehlerarten zu unterscheiden. Nach der Fehlersuche entfernen.
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated-marker', 'true')
  }, [])
  return null
}
