'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getHistory, type HistoryEntry } from '@/lib/history'

const REASON_LABELS: Record<string, string> = {
  gefaellt_nicht: 'Gefällt nicht',
  falsch_geliefert: 'Falsch geliefert',
  defekt_bei_ankunft: 'Defekt bei Ankunft',
  groesse_passt_nicht: 'Größe passt nicht',
  beschaedigt_bei_lieferung: 'Beschädigt bei Lieferung',
  sonstiges: 'Sonstiges',
}

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export default function StatistikScreen() {
  const router = useRouter()
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  if (history.length === 0) {
    return (
      <>
        <header className="page-header">
          <button
            onClick={() => router.push('/')}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', padding: '8px 4px' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 14 }}>Zurück</span>
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Statistik</span>
        </header>
        <div className="empty-state" style={{ marginTop: 80 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="30" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
            <rect x="20" y="20" width="8" height="22" rx="2" stroke="currentColor" strokeWidth="2"/>
            <rect x="32" y="12" width="8" height="30" rx="2" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <p>Noch keine Retouren erfasst.</p>
        </div>
      </>
    )
  }

  const now = new Date()
  const todayStr = now.toDateString()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const countToday = history.filter((e) => new Date(e.submittedAt).toDateString() === todayStr).length
  const countWeek = history.filter((e) => new Date(e.submittedAt) >= sevenDaysAgo).length
  const countTotal = history.length

  // Last 7 days bar chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const dEnd = new Date(d)
    dEnd.setDate(dEnd.getDate() + 1)
    const count = history.filter((e) => {
      const t = new Date(e.submittedAt)
      return t >= d && t < dEnd
    }).length
    return { label: DAY_LABELS[d.getDay()], count }
  })
  const maxDay = Math.max(...last7Days.map((d) => d.count), 1)

  // Most common reasons
  const reasonCounts: Record<string, number> = {}
  for (const entry of history) {
    for (const item of entry.items) {
      reasonCounts[item.reason] = (reasonCounts[item.reason] ?? 0) + 1
    }
  }
  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])
  const maxReason = sortedReasons[0]?.[1] ?? 1

  // By operator
  const operatorMap: Record<string, { count: number; lastDate: string }> = {}
  for (const entry of history) {
    const existing = operatorMap[entry.operatorName]
    if (!existing) {
      operatorMap[entry.operatorName] = { count: 1, lastDate: entry.submittedAt }
    } else {
      existing.count++
      if (new Date(entry.submittedAt) > new Date(existing.lastDate)) {
        existing.lastDate = entry.submittedAt
      }
    }
  }
  const sortedOperators = Object.entries(operatorMap).sort((a, b) => b[1].count - a[1].count)

  return (
    <>
      <header className="page-header">
        <button
          onClick={() => router.push('/')}
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', padding: '8px 4px' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 14 }}>Zurück</span>
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Statistik</span>
      </header>

      <div className="page-content">
        {/* Counter cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 28 }}>
          {[
            { label: 'Heute', value: countToday },
            { label: 'Diese Woche', value: countWeek },
            { label: 'Gesamt', value: countTotal },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Last 7 days bar chart */}
        <div className="section-title" style={{ marginBottom: 14 }}>Letzte 7 Tage</div>
        <div className="card" style={{ marginBottom: 28, padding: '20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 80 }}>
            {last7Days.map(({ label, count }, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{count > 0 ? count : ''}</div>
                <div
                  style={{
                    width: '100%',
                    height: `${(count / maxDay) * 60 + 10}px`,
                    background: count > 0 ? 'var(--blue)' : 'var(--surface-3)',
                    borderRadius: 4,
                    transition: 'height 0.2s',
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Most common reasons */}
        {sortedReasons.length > 0 && (
          <>
            <div className="section-title" style={{ marginBottom: 12 }}>Häufigste Gründe</div>
            <div className="card-section" style={{ marginBottom: 28 }}>
              {sortedReasons.map(([reason, count], i) => (
                <div key={reason}>
                  {i > 0 && <hr />}
                  <div style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{REASON_LABELS[reason] ?? reason}</span>
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / maxReason) * 100}%`, background: 'var(--blue)', borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* By operator */}
        {sortedOperators.length > 0 && (
          <>
            <div className="section-title" style={{ marginBottom: 12 }}>Nach Mitarbeiter</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {sortedOperators.map(([name, { count, lastDate }]) => (
                <div key={name} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--blue-bg)', border: '1px solid var(--blue-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: 'var(--blue)', flexShrink: 0,
                    }}>
                      {name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count} {count === 1 ? 'Retoure' : 'Retouren'}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                    <div>Letzte:</div>
                    <div>{new Date(lastDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
