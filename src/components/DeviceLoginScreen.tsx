'use client'

import { useState, type FormEvent } from 'react'
import { unlockDevice } from '@/lib/device-session'

export default function DeviceLoginScreen() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim() || loading) return

    setLoading(true)
    setError(null)
    try {
      await unlockDevice(code.trim())
      // Volle Navigation statt Router-Push: die Middleware muss das frisch
      // gesetzte Cookie beim nächsten Request sehen
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen')
      setLoading(false)
    }
  }

  return (
    <div
      className="dvh-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        gap: 28,
        overflowY: 'auto',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Gerätefreigabe
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Zugangscode eingeben
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <input
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setError(null)
          }}
          placeholder="Code"
          style={{
            padding: '16px 18px',
            fontSize: 20,
            borderRadius: 'var(--radius)',
            border: `1.5px solid ${error ? 'var(--red-border)' : 'var(--border)'}`,
            background: 'var(--surface)',
            color: 'var(--text)',
            textAlign: 'center',
            letterSpacing: '0.08em',
          }}
        />

        {error && (
          <div
            style={{
              background: 'var(--red-bg)',
              border: '1px solid var(--red-border)',
              color: 'var(--red)',
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={!code.trim() || loading}>
          {loading ? 'Prüfe…' : 'Entsperren'}
        </button>
      </form>
    </div>
  )
}
