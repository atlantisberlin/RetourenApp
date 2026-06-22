'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getOperator, clearOperator } from '@/lib/operator'
import UserSelectionScreen from './UserSelectionScreen'

export default function HomeScreen() {
  const router = useRouter()
  const [operator, setOperator] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setOperator(getOperator())
    setChecked(true)
  }, [])

  if (!checked) return null
  if (!operator) return <UserSelectionScreen onSelect={(name) => setOperator(name)} />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="page-header">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Atlantis
        </span>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Intern</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { clearOperator(); setOperator(null) }}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--surface-3)', border: '1px solid var(--border)',
              borderRadius: 100, padding: '4px 10px 4px 8px',
              fontSize: 13, color: 'var(--text-2)',
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: '50%',
              background: 'var(--blue-bg)', border: '1px solid var(--blue-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'var(--blue)', flexShrink: 0,
            }}>
              {operator[0]}
            </span>
            {operator}
          </button>
        </div>
      </header>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 20px 48px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Wareneingang & Versand
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Was möchtest du tun?
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 480 }}>
          {/* Retouren */}
          <button
            onClick={() => router.push('/retouren')}
            style={{
              all: 'unset', cursor: 'pointer',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '24px 24px 22px',
              display: 'flex', alignItems: 'center', gap: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.12s',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--blue)'
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(47,107,214,0.14)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
              e.currentTarget.style.transform = 'none'
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M5 13 L17 13 L17 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 13 L9.5 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 13 L9.5 17.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Retouren erfassen</div>
              <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.4 }}>
                Bestellung suchen, Artikel aufnehmen, an Asana senden
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Versand */}
          <button
            onClick={() => router.push('/versand')}
            style={{
              all: 'unset', cursor: 'pointer',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '24px 24px 22px',
              display: 'flex', alignItems: 'center', gap: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.12s',
              position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--purple)'
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(91,83,201,0.14)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
              e.currentTarget.style.transform = 'none'
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M13 5 L21 13 L13 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 13 L21 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Versand dokumentieren</div>
              <div style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.4 }}>
                Sendungen vor dem Versand fotografieren und erfassen
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Statistik */}
          <button
            onClick={() => router.push('/statistik')}
            style={{
              all: 'unset', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '14px',
              fontSize: 14, color: 'var(--text-3)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="10" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="1.25"/>
              <rect x="6.5" y="7" width="3" height="7" rx="1" stroke="currentColor" strokeWidth="1.25"/>
              <rect x="11" y="4" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.25"/>
            </svg>
            Statistik
          </button>
        </div>
      </div>
    </div>
  )
}
