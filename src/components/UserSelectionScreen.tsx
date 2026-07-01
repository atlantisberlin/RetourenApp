'use client'

import { useState } from 'react'
import { OPERATORS } from '@/lib/operator'
import { createSession } from '@/lib/client-session'

export default function UserSelectionScreen({ onSelect }: { onSelect: (name: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleTile(name: string) {
    setSelected((prev) => (prev === name ? null : name))
    setError(null)
  }

  async function handleConfirm() {
    if (!selected) return

    try {
      setError(null)
      // Create JWT session on backend
      await createSession(selected)
      setConfirming(true)
      setTimeout(() => onSelect(selected), 1400)
    } catch (err) {
      setError('Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.')
      console.error('Session creation error:', err)
    }
  }

  if (confirming && selected) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, zIndex: 50,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--blue-bg)',
          border: '2px solid var(--blue-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: 'var(--blue)',
        }}>
          {selected[0]}
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Hallo, {selected}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-3)' }}>
          Bereit für den Wareneingang
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="page-header">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Atlantis
        </span>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Retouren-App</span>
      </header>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px 40px', gap: 28,
      }}>
        {error && (
          <div style={{
            background: 'var(--red-bg)',
            border: '1px solid var(--red-border)',
            color: 'var(--red)',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            fontSize: 14,
            maxWidth: 520,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Wareneingang
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Wer nimmt heute an?
          </h1>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 14, width: '100%', maxWidth: 520,
        }}>
          {OPERATORS.map((name) => {
            const isSelected = selected === name
            const isDimmed = selected !== null && !isSelected
            return (
              <button
                key={name}
                onClick={() => handleTile(name)}
                style={{
                  all: 'unset',
                  position: 'relative',
                  background: isSelected ? 'var(--blue)' : 'var(--surface)',
                  border: `1.5px solid ${isSelected ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  boxShadow: isSelected
                    ? '0 8px 32px rgba(47,107,214,0.18), 0 2px 8px rgba(47,107,214,0.10)'
                    : '0 2px 8px rgba(0,0,0,0.06)',
                  padding: '28px 24px 22px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'flex-start', justifyContent: 'flex-end',
                  minHeight: 150,
                  opacity: isDimmed ? 0.4 : 1,
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  transition: 'all 0.18s',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Ghost initial */}
                <span style={{
                  position: 'absolute', top: -16, right: -8,
                  fontSize: 160, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1,
                  color: isSelected ? '#fff' : 'var(--blue)',
                  opacity: isSelected ? 0.12 : 0.055,
                  pointerEvents: 'none',
                  transition: 'opacity 0.18s, color 0.18s',
                }}>
                  {name[0]}
                </span>
                <span style={{
                  fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em',
                  color: isSelected ? '#fff' : 'var(--text)',
                  position: 'relative', zIndex: 1,
                  transition: 'color 0.18s',
                }}>
                  {name}
                </span>
                <span style={{
                  fontSize: 12, marginTop: 3,
                  color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                  position: 'relative', zIndex: 1,
                  transition: 'color 0.18s',
                }}>
                  Wareneingang
                </span>
              </button>
            )
          })}
        </div>

        <div style={{
          width: '100%', maxWidth: 520,
          opacity: selected ? 1 : 0,
          transform: selected ? 'translateY(0)' : 'translateY(8px)',
          pointerEvents: selected ? 'auto' : 'none',
          transition: 'opacity 0.2s, transform 0.2s',
        }}>
          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={handleConfirm}
            disabled={!selected}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9l3.5 3.5L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Als {selected} anmelden
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 28px', lineHeight: 1.5 }}>
        Nach 10 Minuten Inaktivität wird der Name automatisch abgemeldet.
      </div>
    </div>
  )
}
