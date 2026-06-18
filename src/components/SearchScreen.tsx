'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Order, SearchResult } from '@/lib/types'

const HINTS = ['Bestellnr.', 'Kundennr.', 'Rechnungsnr.', 'Name']

export default function SearchScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Order[]>([])
  const [mode, setMode] = useState<'live' | 'demo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [hasSearched, setHasSearched] = useState(false)

  const search = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([])
        setHasSearched(false)
        return
      }
      setError(null)
      startTransition(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
          if (!res.ok) throw new Error(await res.text())
          const data: SearchResult = await res.json()
          setResults(data.orders)
          setMode(data.mode)
          setHasSearched(true)
        } catch (e) {
          setError(String(e))
          setResults([])
          setHasSearched(true)
        }
      })
    },
    []
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(query)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    if (!e.target.value.trim()) {
      setResults([])
      setHasSearched(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Atlantis
        </span>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Retouren-App</span>
        {mode === 'demo' && (
          <span className="badge badge-gold" style={{ marginLeft: 'auto' }}>Demo-Modus</span>
        )}
        {mode === 'live' && (
          <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Zentrallager · Live</span>
        )}
      </header>

      <div className="page-content" style={{ paddingTop: 32 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>Retoure erfassen</h1>
          <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Bestellung über Nummer oder Name suchen.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="input-wrap input-icon-left" style={{ flex: 1 }}>
              <svg className="input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M14 14l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                className="input"
                type="search"
                value={query}
                onChange={handleChange}
                placeholder="Bestellnr., Name, Kundennr. …"
                autoFocus
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending || !query.trim()}
              style={{ minWidth: 100 }}
            >
              {isPending ? (
                <Spinner />
              ) : (
                'Suchen'
              )}
            </button>
          </div>
        </form>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 28 }}>
          {HINTS.map((h) => (
            <span
              key={h}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-muted)',
                background: 'var(--surface-3)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 9px',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {error && (
          <div style={{ border: '1px solid var(--red-border)', background: 'var(--red-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 14, color: 'var(--red-dark)' }}>
            Fehler bei der Suche: {error}
          </div>
        )}

        {!hasSearched && !isPending && (
          <div className="empty-state">
            <SearchIcon />
            <p>Bestellnummer, Kundennummer oder Namen eingeben, um eine Bestellung zu finden.</p>
          </div>
        )}

        {hasSearched && results.length === 0 && !isPending && (
          <div className="empty-state">
            <EmptyIcon />
            <p>Keine Bestellung gefunden für „{query}".</p>
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="section-title">{results.length} Treffer</div>
            {results.map((order) => (
              <button
                key={order.id}
                onClick={() => router.push(`/order/${order.id}`)}
                style={{
                  all: 'unset',
                  display: 'block',
                  cursor: 'pointer',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--purple-border)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px var(--purple-bg)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{order.customerName}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                      #{order.orderNumber}
                      {order.customerNumber ? ` · KD ${order.customerNumber}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>{order.date}</div>
                    <span className="badge badge-blue">{order.source ?? 'Zentrallager'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {order.items.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      style={{
                        fontSize: 12,
                        color: 'var(--text-3)',
                        background: 'var(--surface-3)',
                        border: '1px solid var(--border-2)',
                        borderRadius: 5,
                        padding: '2px 7px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 200,
                      }}
                    >
                      {item.productName}
                    </span>
                  ))}
                  {order.items.length > 3 && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 4px' }}>
                      +{order.items.length - 3} weitere
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="21" cy="21" r="14" stroke="currentColor" strokeWidth="2"/>
      <path d="M38 38l-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="10" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 22h16M16 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
