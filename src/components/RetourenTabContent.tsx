'use client'

import { useState, useEffect } from 'react'
import type { HistoryEntry } from '@/lib/history'
import { apiGet } from '@/lib/api-client'

const REASON_LABELS: Record<string, string> = {
  gefaellt_nicht: 'Gefällt nicht',
  falsch_geliefert: 'Falsch geliefert',
  defekt_bei_ankunft: 'Defekt bei Ankunft',
  groesse_passt_nicht: 'Größe passt nicht',
  beschaedigt_bei_lieferung: 'Beschädigt bei Lieferung',
  sonstiges: 'Sonstiges',
}

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function CounterCards({ today, week, total }: { today: number; week: number; total: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 28 }}>
      {[{ label: 'Heute', value: today }, { label: 'Diese Woche', value: week }, { label: 'Gesamt', value: total }].map(({ label, value }) => (
        <div key={label} className="card" style={{ textAlign: 'center', padding: '18px 12px' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

function BarChart({ data, color }: { data: { label: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="card" style={{ marginBottom: 28, padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 80 }}>
        {data.map(({ label, count }, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{count > 0 ? count : ''}</div>
            <div style={{ width: '100%', height: `${(count / max) * 60 + 10}px`, background: count > 0 ? color : 'var(--surface-3)', borderRadius: 4, transition: 'height 0.2s' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OperatorList({ entries }: { entries: { name: string; count: number; lastDate: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
      {entries.map(({ name, count, lastDate }) => (
        <div key={name} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'var(--blue-bg)',
              border: '1px solid var(--blue-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--blue)',
            }}>
              {name[0]}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count} {count === 1 ? 'Eintrag' : 'Einträge'}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
            <div>Letzte:</div>
            <div>{new Date(lastDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function getLast7Days(entries: { submittedAt: string }[]) {
  const now = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const dEnd = new Date(d)
    dEnd.setDate(dEnd.getDate() + 1)
    const count = entries.filter((e) => { const t = new Date(e.submittedAt); return t >= d && t < dEnd }).length
    return { label: DAY_LABELS[d.getDay()], count }
  })
}

function getOperatorStats(entries: { operatorName: string; submittedAt: string }[]) {
  const map: Record<string, { count: number; lastDate: string }> = {}
  for (const e of entries) {
    if (!map[e.operatorName]) map[e.operatorName] = { count: 1, lastDate: e.submittedAt }
    else {
      map[e.operatorName].count++
      if (new Date(e.submittedAt) > new Date(map[e.operatorName].lastDate)) map[e.operatorName].lastDate = e.submittedAt
    }
  }
  return Object.entries(map).sort((a, b) => b[1].count - a[1].count).map(([name, v]) => ({ name, ...v }))
}

export function RetourenTabContent() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<{ entries: HistoryEntry[]; configured: boolean }>('/api/history')
      .then((data) => {
        if (cancelled) return
        setHistory(data.entries)
        setConfigured(data.configured)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <p>Verlauf konnte nicht geladen werden: {error}</p>
      </div>
    )
  }

  if (history === null) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <p>Lade Statistik…</p>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <p>Asana ist nicht konfiguriert — Statistik nicht verfügbar.</p>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="30" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
          <rect x="20" y="20" width="8" height="22" rx="2" stroke="currentColor" strokeWidth="2"/>
          <rect x="32" y="12" width="8" height="30" rx="2" stroke="currentColor" strokeWidth="2"/>
        </svg>
        <p>Noch keine Retouren erfasst.</p>
      </div>
    )
  }

  const now = new Date()
  const todayStr = now.toDateString()
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0, 0, 0, 0)

  const reasonCounts: Record<string, number> = {}
  for (const e of history) for (const item of e.items) reasonCounts[item.reason] = (reasonCounts[item.reason] ?? 0) + 1
  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])
  const maxReason = sortedReasons[0]?.[1] ?? 1

  return (
    <div className="page-content" style={{ paddingTop: 0 }}>
      <CounterCards
        today={history.filter((e) => new Date(e.submittedAt).toDateString() === todayStr).length}
        week={history.filter((e) => new Date(e.submittedAt) >= sevenDaysAgo).length}
        total={history.length}
      />

      <div className="section-title" style={{ marginBottom: 14 }}>Letzte 7 Tage</div>
      <BarChart data={getLast7Days(history)} color="var(--blue)" />

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

      {getOperatorStats(history).length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: 12 }}>Nach Mitarbeiter</div>
          <OperatorList entries={getOperatorStats(history)} />
        </>
      )}
    </div>
  )
}
