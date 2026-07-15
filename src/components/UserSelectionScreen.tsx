'use client'

import { useState } from 'react'
import { OPERATORS } from '@/lib/operator'
import { createSession } from '@/lib/client-session'

// Gleiche Zeichen wie SessionCreateSchema auf dem Server — sofortiges
// Feedback im Feld statt erst nach einem fehlgeschlagenen Request
const NAME_PATTERN = /^[a-zA-Z0-9äöüßÄÖÜ\s\-]+$/

export default function UserSelectionScreen({ onSelect }: { onSelect: (name: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = (selected ?? '').trim()
  const customNameInvalid = customMode && trimmedName.length > 0 && !NAME_PATTERN.test(trimmedName)

  function handleTile(name: string) {
    setSelected((prev) => (prev === name ? null : name))
    setError(null)
  }

  function handleShowCustom() {
    setSelected(null)
    setCustomMode(true)
    setError(null)
  }

  function handleBackToGrid() {
    setSelected(null)
    setCustomMode(false)
    setError(null)
  }

  async function handleConfirm() {
    const name = trimmedName
    if (!name || customNameInvalid) return

    try {
      setError(null)
      // Merkt sich den Namen für die gesamte Sitzung (JWT + localStorage,
      // wie bei den vier festen Namen) und wird bei jeder Asana-Übergabe
      // als "Bearbeitet von" mitgeschickt.
      await createSession(name)
      setSelected(name)
      setConfirming(true)
      setTimeout(() => onSelect(name), 1400)
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
    <div className="dvh-shell" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
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

        {!customMode ? (
          <>
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

            <button
              onClick={handleShowCustom}
              style={{
                all: 'unset', cursor: 'pointer',
                width: '100%', maxWidth: 520,
                border: '1.5px dashed var(--border)',
                borderRadius: 'var(--radius)',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: 'var(--text-muted)',
                fontSize: 15, fontWeight: 500,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              Weitere Person
            </button>
          </>
        ) : (
          <div style={{ width: '100%', maxWidth: 520 }}>
            <button
              onClick={handleBackToGrid}
              style={{
                all: 'unset', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                color: 'var(--text-3)', fontSize: 14, padding: '4px 0', marginBottom: 20,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              Zurück zur Auswahl
            </button>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
              NAME
            </label>
            <input
              className="input"
              type="text"
              value={selected ?? ''}
              onChange={(e) => { setSelected(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && trimmedName && !customNameInvalid) handleConfirm() }}
              placeholder="z. B. Max Mustermann"
              maxLength={100}
              autoComplete="off"
            />
            {customNameInvalid && (
              <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 8 }}>
                Bitte nur Buchstaben, Zahlen, Leerzeichen und Bindestriche verwenden.
              </div>
            )}
          </div>
        )}

        <div style={{
          width: '100%', maxWidth: 520,
          opacity: trimmedName ? 1 : 0,
          transform: trimmedName ? 'translateY(0)' : 'translateY(8px)',
          pointerEvents: trimmedName ? 'auto' : 'none',
          transition: 'opacity 0.2s, transform 0.2s',
        }}>
          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={handleConfirm}
            disabled={!trimmedName || customNameInvalid}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9l3.5 3.5L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Als {trimmedName} anmelden
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '0 20px 28px', lineHeight: 1.5 }}>
        Nach 10 Minuten Inaktivität wird der Name automatisch abgemeldet.
      </div>
    </div>
  )
}
