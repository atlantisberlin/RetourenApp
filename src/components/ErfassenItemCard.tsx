'use client'

import Image from 'next/image'
import type { Order, ReturnCondition, ReturnReason, ReturnResolution, ReturnItemCapture } from '@/lib/types'

const CONDITIONS: { value: ReturnCondition; label: string }[] = [
  { value: 'gut', label: 'Gut' },
  { value: 'beschaedigt', label: 'Beschädigt' },
  { value: 'unvollstaendig', label: 'Unvollständig' },
  { value: 'defekt', label: 'Defekt' },
]

const REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'gefaellt_nicht', label: 'Gefällt nicht' },
  { value: 'falsch_geliefert', label: 'Falsch geliefert' },
  { value: 'defekt_bei_ankunft', label: 'Defekt bei Ankunft' },
  { value: 'groesse_passt_nicht', label: 'Größe passt nicht' },
  { value: 'beschaedigt_bei_lieferung', label: 'Beschädigt bei Lieferung' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

const RESOLUTIONS: { value: ReturnResolution; label: string }[] = [
  { value: 'erstattung', label: 'Erstattung' },
  { value: 'umtausch', label: 'Umtausch' },
]

interface ErfassenItemCardProps {
  item: Order['items'][0]
  capture: ReturnItemCapture
  onUpdateCapture: (patch: Partial<ReturnItemCapture>) => void
}

export function ErfassenItemCard({ item, capture, onUpdateCapture }: ErfassenItemCardProps) {
  const isGutschrift = !!item.existingGutschrift
  const isRetoure = !!item.existingRetoure && !isGutschrift

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: isGutschrift
          ? '1.5px solid var(--border)'
          : isRetoure
          ? '1.5px solid #93c5fd'
          : `1.5px solid ${capture.returned ? 'var(--purple-border)' : 'var(--border)'}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
        opacity: isGutschrift ? 0.45 : 1,
        pointerEvents: isGutschrift ? 'none' : undefined,
      }}
    >
      {/* Article header row */}
      <label
        style={{
          display: 'flex',
          gap: 14,
          padding: '16px 18px',
          cursor: isGutschrift ? 'default' : 'pointer',
          background: capture.returned ? 'var(--purple-bg)' : isRetoure ? '#eff6ff' : 'transparent',
          transition: 'background 0.15s',
          alignItems: 'flex-start',
        }}
      >
        <input
          type="checkbox"
          className="check-toggle"
          checked={capture.returned}
          onChange={(e) => onUpdateCapture({ returned: e.target.checked })}
          disabled={isGutschrift}
          style={{ marginTop: 2 }}
        />
        {item.imageUrl && (
          <Image src={item.imageUrl} alt={item.productName} width={44} height={44} style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, lineHeight: 1.3 }}>
            {item.productName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {item.sku && <span style={{ fontFamily: 'var(--font-mono)' }}>{item.sku}</span>}
            <span>Bestellt: {item.quantity}×</span>
            <span>{item.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
            {item.existingRetoure && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 4, padding: '1px 5px' }}>
                Retoure {item.existingRetoure}
              </span>
            )}
            {item.existingGutschrift && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: '#ede9fe', color: '#5b21b6', border: '1px solid #ddd6fe', borderRadius: 4, padding: '1px 5px' }}>
                Gutschrift {item.existingGutschrift}
              </span>
            )}
          </div>
        </div>
        {!capture.returned && !isGutschrift && (
          <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>antippen</span>
        )}
      </label>

      {/* Expanded capture fields */}
      {capture.returned && (
        <div style={{ padding: '16px 18px', borderTop: '1px solid var(--purple-border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quantity */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>Zurückgekommen</label>
            <div className="qty-stepper">
              <button
                type="button"
                className="qty-btn"
                onClick={() => onUpdateCapture({ returnedQuantity: Math.max(1, capture.returnedQuantity - 1) })}
              >−</button>
              <span className="qty-val">{capture.returnedQuantity}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={() => onUpdateCapture({ returnedQuantity: Math.min(item.quantity, capture.returnedQuantity + 1) })}
              >+</button>
            </div>
          </div>

          {/* Condition + Reason in one row on wider screens */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>ZUSTAND</div>
              <select
                className="select"
                value={capture.condition}
                onChange={(e) => onUpdateCapture({ condition: e.target.value as ReturnCondition })}
                style={{ width: '100%' }}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>GRUND</div>
              <select
                className="select"
                value={capture.reason}
                onChange={(e) => onUpdateCapture({ reason: e.target.value as ReturnReason })}
                style={{ width: '100%' }}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Resolution toggle */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>WUNSCH</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => onUpdateCapture({ resolution: r.value })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 8,
                    border: `1.5px solid ${capture.resolution === r.value ? 'var(--purple)' : 'var(--border)'}`,
                    background: capture.resolution === r.value ? 'var(--purple-bg)' : 'var(--surface)',
                    color: capture.resolution === r.value ? 'var(--purple)' : 'var(--text-3)',
                    fontWeight: capture.resolution === r.value ? 600 : 400,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <textarea
              value={capture.notes}
              onChange={(e) => onUpdateCapture({ notes: e.target.value })}
              placeholder="Bemerkung (optional)"
              rows={2}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'var(--font-sans)',
                color: 'var(--text)',
                background: 'var(--surface)',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
