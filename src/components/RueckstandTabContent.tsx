'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { ReactNode, PointerEvent } from 'react'
import { apiGet } from '@/lib/api-client'
import type { BacklogEntry } from '@/lib/asana-history'

const TREND_DAYS = 14
const AGING_LIMIT = 6

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function fmtDay(daysAgo: number): string {
  if (daysAgo === 0) return 'heute'
  if (daysAgo === 1) return 'gestern'
  return `vor ${daysAgo} Tagen`
}

function isOpenAt(entry: BacklogEntry, daysAgo: number): boolean {
  if (daysSince(entry.createdAt) < daysAgo) return false // noch nicht angenommen
  if (entry.isOpen) return true
  if (!entry.resolvedAt) return true
  return daysSince(entry.resolvedAt) < daysAgo // war zu dem Zeitpunkt noch offen
}

function Badge({ text, tone }: { text: string; tone: 'gold' | 'red' }) {
  return <span className={`badge badge-${tone}`}>{text}</span>
}

function Breakdown({ label, sub, count, max, total }: { label: string; sub: string; count: number; max: number; total: number }) {
  return (
    <div style={{ padding: '13px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7, gap: 10 }}>
        <div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
        </div>
        <div className="mono" style={{ fontSize: 13.5, color: 'var(--text-2)', fontWeight: 600, flexShrink: 0 }}>
          {count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {total}</span>
        </div>
      </div>
      <div style={{ height: 7, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${max > 0 ? (count / max) * 100 : 0}%`, borderRadius: 4, background: 'var(--gold)' }} />
      </div>
    </div>
  )
}

function AgingRow({ entry }: { entry: BacklogEntry }) {
  const chips: ReactNode[] = []
  if (entry.overdueInvoice) chips.push(<Badge key="overdue" text="Rechnung > 14 Tage" tone="red" />)
  if (entry.needsRetoure) chips.push(<Badge key="retoure" text="Retoure anlegen" tone="gold" />)
  if (entry.needsGutschrift) chips.push(<Badge key="gutschrift" text="Gutschrift" tone="gold" />)
  if (entry.needsUmtausch) chips.push(<Badge key="umtausch" text="Umtausch" tone="gold" />)
  const days = daysSince(entry.createdAt)

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '13px 16px 13px 13px',
      borderLeft: `3px solid ${entry.overdueInvoice ? 'var(--red)' : 'transparent'}`,
      background: entry.overdueInvoice ? 'linear-gradient(to right, var(--red-bg), transparent 60%)' : 'none',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.customerName || 'Unbekannt'}{entry.firstProductName ? ` · ${entry.firstProductName}` : ''}
          </span>
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: entry.overdueInvoice ? 'var(--red-dark)' : 'var(--text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {days} Tage
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {[entry.source, entry.orderNumber ? `Bestellnr. ${entry.orderNumber}` : null, `angenommen ${fmtDate(entry.createdAt)}`].filter(Boolean).join(' · ')}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{chips}</div>
      </div>
    </div>
  )
}

function TrendChart({ trend }: { trend: { daysAgo: number; count: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 420, H = 140, PAD_L = 4, PAD_R = 4, PAD_T = 18, PAD_B = 20

  const values = trend.map((t) => t.count)
  const vMin = Math.min(...values), vMax = Math.max(...values)
  const yFor = (v: number) => PAD_T + (1 - (v - vMin) / (vMax - vMin || 1)) * (H - PAD_T - PAD_B)
  const xFor = (i: number) => PAD_L + (i / (trend.length - 1)) * (W - PAD_L - PAD_R)

  const gridValues = [vMin, Math.round((vMin + vMax) / 2), vMax]
  const linePoints = trend.map((t, i) => `${xFor(i)},${yFor(t.count)}`).join(' ')
  const areaPoints = `${xFor(0)},${H - PAD_B} ${linePoints} ${xFor(trend.length - 1)},${H - PAD_B}`
  const lastIdx = trend.length - 1

  const handleMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = ((e.clientX - rect.left) / rect.width) * W
    let closest = 0, closestDist = Infinity
    trend.forEach((_, i) => {
      const dist = Math.abs(xFor(i) - relX)
      if (dist < closestDist) { closestDist = dist; closest = i }
    })
    setHover(closest)
  }

  const hoveredPoint = hover != null ? trend[hover] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="rueckstandAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridValues.map((v, i) => (
          <line key={i} x1={PAD_L} y1={yFor(v)} x2={W - PAD_R} y2={yFor(v)} stroke="var(--border-2)" strokeWidth="1" />
        ))}
        <polygon points={areaPoints} fill="url(#rueckstandAreaFill)" />
        <polyline points={linePoints} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xFor(lastIdx)} cy={yFor(trend[lastIdx].count)} r="4" fill="var(--blue)" stroke="var(--surface)" strokeWidth="2" />
        <text x={xFor(lastIdx)} y={yFor(trend[lastIdx].count) - 11} textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="var(--blue-dark)">
          {trend[lastIdx].count}
        </text>
        <text x={PAD_L} y={H - 4} fontFamily="var(--font-mono)" fontSize="10" fill="var(--text-muted)">{fmtDay(trend[0].daysAgo)}</text>
        <text x={W - PAD_R} y={H - 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="var(--text-muted)">heute</text>
        {hoveredPoint && (
          <>
            <line x1={xFor(hover!)} y1={PAD_T} x2={xFor(hover!)} y2={H - PAD_B} stroke="var(--text-faint)" strokeWidth="1" strokeDasharray="2,3" />
            <circle cx={xFor(hover!)} cy={yFor(hoveredPoint.count)} r="4" fill="var(--blue-dark)" />
          </>
        )}
        <rect x="0" y="0" width={W} height={H} fill="transparent" onPointerMove={handleMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hoveredPoint && (
        <div style={{
          position: 'absolute', pointerEvents: 'none',
          left: `${(xFor(hover!) / W) * 100}%`, top: `${(yFor(hoveredPoint.count) / H) * 100}%`,
          transform: 'translate(-50%, -130%)',
          background: 'var(--text)', color: '#fff', fontSize: 11.5, fontFamily: 'var(--font-mono)',
          padding: '6px 9px', borderRadius: 7, whiteSpace: 'nowrap', lineHeight: 1.5, zIndex: 5,
        }}>
          <span style={{ color: 'var(--text-faint)', display: 'block', fontSize: 10, marginBottom: 1 }}>
            {fmtDay(hoveredPoint.daysAgo)} · {fmtDate(new Date(Date.now() - hoveredPoint.daysAgo * 86400000).toISOString())}
          </span>
          {hoveredPoint.count} offene Retouren
        </div>
      )}
    </div>
  )
}

export function RueckstandTabContent() {
  const [entries, setEntries] = useState<BacklogEntry[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<{ entries: BacklogEntry[]; configured: boolean }>('/api/backlog')
      .then((data) => {
        if (cancelled) return
        setEntries(data.entries)
        setConfigured(data.configured)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => {
    if (!entries) return null
    const open = entries.filter((e) => e.isOpen)
    const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
      const daysAgo = TREND_DAYS - 1 - i
      return { daysAgo, count: entries.filter((e) => isOpenAt(e, daysAgo)).length }
    })
    const aging = [...open].sort((a, b) => daysSince(b.createdAt) - daysSince(a.createdAt)).slice(0, AGING_LIMIT)

    return {
      totalOpen: open.length,
      needsRetoure: open.filter((e) => e.needsRetoure).length,
      needsGutschrift: open.filter((e) => e.needsGutschrift).length,
      needsUmtausch: open.filter((e) => e.needsUmtausch).length,
      overdueOpen: open.filter((e) => e.overdueInvoice).length,
      closedThisWeek: entries.filter((e) => !e.isOpen && e.resolvedAt && daysSince(e.resolvedAt) <= 6).length,
      newThisWeek: entries.filter((e) => daysSince(e.createdAt) <= 6).length,
      trend,
      aging,
      heroDelta: open.length - trend[0].count,
    }
  }, [entries])

  if (error) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <p>Rückstand konnte nicht geladen werden: {error}</p>
      </div>
    )
  }

  if (entries === null || stats === null) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <p>Lade Rückstand…</p>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <p>Asana ist nicht konfiguriert — Rückstand nicht verfügbar.</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="30" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
          <rect x="20" y="20" width="8" height="22" rx="2" stroke="currentColor" strokeWidth="2" />
          <rect x="32" y="12" width="8" height="30" rx="2" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p>Noch keine Retouren erfasst.</p>
      </div>
    )
  }

  const BREAKDOWN = [
    { label: 'Retoure noch nicht angelegt', sub: 'Kunde oder Kolleg:in muss die Retoure im Shop-System nachtragen', count: stats.needsRetoure },
    { label: 'Gutschrift ausständig', sub: 'Erstattung für den Kunden noch nicht ausgestellt', count: stats.needsGutschrift },
    { label: 'Umtausch ausständig', sub: 'Ersatzartikel noch nicht rausgegangen', count: stats.needsUmtausch },
  ]
  const maxBreakdown = Math.max(...BREAKDOWN.map((b) => b.count), 1)

  return (
    <div className="page-content" style={{ paddingTop: 0 }}>

      {/* Hero */}
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.01em' }}>{stats.totalOpen}</span>
          {stats.heroDelta !== 0 && (
            <span className="mono" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600,
              padding: '3px 8px 3px 6px', borderRadius: 6,
              color: stats.heroDelta > 0 ? 'var(--red-dark)' : 'var(--green)',
              background: stats.heroDelta > 0 ? 'var(--red-bg)' : 'var(--green-bg)',
            }}>
              {stats.heroDelta > 0 ? '↑ +' : '↓ '}{Math.abs(stats.heroDelta)}
              <span style={{ opacity: 0.75, fontWeight: 500 }}>/ {TREND_DAYS} Tage</span>
            </span>
          )}
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--text-3)', marginBottom: 16 }}>
          offene Retouren — angenommen, aber noch nicht vollständig bearbeitet
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-3)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
            {stats.closedThisWeek} abgeschlossen diese Woche
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-3)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />
            {stats.newThisWeek} neu angenommen diese Woche
          </div>
        </div>
      </div>

      <div className="section-title">Was noch fehlt</div>
      <div className="card-section" style={{ marginBottom: 22 }}>
        {BREAKDOWN.map((b, i) => (
          <div key={b.label}>
            {i > 0 && <hr />}
            <Breakdown label={b.label} sub={b.sub} count={b.count} max={maxBreakdown} total={stats.totalOpen} />
          </div>
        ))}
      </div>

      {stats.overdueOpen > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderRadius: 'var(--radius-lg)',
          background: 'var(--red-bg)', border: '1px solid var(--red-border)', marginBottom: 26,
        }}>
          <svg width="19" height="19" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
            <path d="M9 2L1.5 15.5h15L9 2z" stroke="#b34a36" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M9 7v4" stroke="#b34a36" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="9" cy="13" r="0.75" fill="#b34a36" />
          </svg>
          <div style={{ fontSize: 13.5, color: 'var(--red-dark)', lineHeight: 1.4, flex: 1 }}>
            <strong>{stats.overdueOpen}</strong> {stats.overdueOpen === 1 ? 'Retoure' : 'Retouren'} von {stats.totalOpen} — Rechnung länger als 14 Tage offen, aber noch nicht abgeschlossen.
          </div>
        </div>
      )}

      {stats.aging.length > 0 && (
        <>
          <div className="section-title">Am längsten offen</div>
          <div className="card-section" style={{ marginBottom: 26 }}>
            {stats.aging.map((entry, i) => (
              <div key={entry.taskGid}>
                {i > 0 && <hr />}
                <AgingRow entry={entry} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Rückstand — letzte {TREND_DAYS} Tage</div>
      <div className="card" style={{ padding: '18px 18px 8px', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)' }}>Offene Retouren zum Tagesende</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {fmtDate(new Date(Date.now() - stats.trend[0].daysAgo * 86400000).toISOString())} – {fmtDate(new Date().toISOString())}
          </span>
        </div>
        <TrendChart trend={stats.trend} />
      </div>
    </div>
  )
}
