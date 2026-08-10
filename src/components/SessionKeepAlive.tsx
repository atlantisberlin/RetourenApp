'use client'

import { useEffect } from 'react'
import { isOperatorActive } from '@/lib/operator'
import { getSessionExpiry, refreshSession } from '@/lib/client-session'

// Alle 5 Minuten prüfen; das Token erneuern, sobald weniger als 2 Stunden
// Restlaufzeit bleiben. Bei 24h-Token bedeutet das: läuft ein Mitarbeiter
// durchgehend aktiv, wird sein Token rechtzeitig vor Ablauf verlängert und die
// Sitzung reißt nicht mitten in der Arbeit.
//
// Maßgeblich bleibt der Idle-Logout (10 Min, in operator.ts): ist der
// Mitarbeiter inaktiv, wird NICHT erneuert und die Sitzung läuft normal ab.
const CHECK_INTERVAL_MS = 5 * 60 * 1000
const REFRESH_WHEN_REMAINING_MS = 2 * 60 * 60 * 1000

/**
 * Unsichtbare Komponente (rendert nichts), die im Root-Layout hängt und das
 * Mitarbeiter-Token still im Hintergrund frisch hält. Deckt damit jede Seite
 * ab, auf der ein Mitarbeiter arbeitet.
 */
export default function SessionKeepAlive() {
  useEffect(() => {
    let running = false

    async function tick() {
      if (running) return
      // Nur erneuern, solange der Mitarbeiter aktiv ist — ohne Seiteneffekt,
      // damit dieser Hintergrund-Timer keinen Logout auslöst.
      if (!isOperatorActive()) return
      const exp = getSessionExpiry()
      if (exp == null) return
      if (exp * 1000 - Date.now() > REFRESH_WHEN_REMAINING_MS) return
      running = true
      try {
        await refreshSession()
      } finally {
        running = false
      }
    }

    const id = setInterval(tick, CHECK_INTERVAL_MS)
    // Beim Zurückkehren zur App (Tab wieder sichtbar / fokussiert) sofort
    // prüfen — Hintergrund-Tabs drosseln Timer, hier holen wir das nach.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  return null
}
