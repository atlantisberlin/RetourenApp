'use client'

import { useState } from 'react'
import { getVersandHistory, deleteFromVersandHistory } from '@/lib/versandHistory'

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
              background: 'var(--purple-bg)',
              border: '1px solid var(--purple-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--purple)',
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

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 8,
        border: '1px solid var(--red-border)', color: 'var(--red)', flexShrink: 0,
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--red-bg)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M11 3.5l-.7 7.7a1 1 0 0 1-1 .8H4.7a1 1 0 0 1-1-.8L3 3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
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

export function VersandTabContent({ isErik }: { isErik: boolean }) {
  const [history, setHistory] = useState(() => getVersandHistory())

  function handleDelete(id: string) { deleteFromVersandHistory(id); setHistory(getVersandHistory()) }

  if (history.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="30" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
          <rect x="20" y="20" width="8" height="22" rx="2" stroke="currentColor" strokeWidth="2"/>
          <rect x="32" y="12" width="8" height="30" rx="2" stroke="currentColor" strokeWidth="2"/>
        </svg>
        <p>Noch keine Sendungen dokumentiert.</p>
      </div>
    )
  }

  const now = new Date()
  const todayStr = now.toDateString()
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0, 0, 0, 0)

  const carrierCounts: Record<string, number> = {}
  for (const e of history) {
    const c = e.carrier || 'Unbekannt'
    carrierCounts[c] = (carrierCounts[c] ?? 0) + 1
  }
  const sortedCarriers = Object.entries(carrierCounts).sort((a, b) => b[1] - a[1])
  const maxCarrier = sortedCarriers[0]?.[1] ?? 1

  return (
    <div className="page-content" style={{ paddingTop: 0 }}>
      <CounterCards
        today={history.filter((e) => new Date(e.submittedAt).toDateString() === todayStr).length}
        week={history.filter((e) => new Date(e.submittedAt) >= sevenDaysAgo).length}
        total={history.length}
      />

      <div className="section-title" style={{ marginBottom: 14 }}>Letzte 7 Tage</div>
      <BarChart data={getLast7Days(history)} color="var(--purple)" />

      {sortedCarriers.length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: 12 }}>Nach Logistikunternehmen</div>
          <div className="card-section" style={{ marginBottom: 28 }}>
            {sortedCarriers.map(([carrier, count], i) => (
              <div key={carrier}>
                {i > 0 && <hr />}
                <div style={{ padding: '12px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{carrier}</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / maxCarrier) * 100}%`, background: 'var(--purple)', borderRadius: 3 }} />
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

      {isErik && (
        <>
          <div className="section-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            Verlauf verwalten
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-muted)', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>Admin</span>
          </div>
          <div className="card-section" style={{ marginBottom: 28 }}>
            {history.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <hr />}
                <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                      {entry.carrier ? `${entry.carrier} · ` : ''}{entry.trackingNumber}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {entry.operatorName} · {new Date(entry.submittedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                  <DeleteButton onClick={() => handleDelete(entry.id)} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
