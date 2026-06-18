'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

function defaultItemCapture(item: { id: string; quantity: number }): ReturnItemCapture {
  return {
    itemId: item.id,
    returned: false,
    returnedQuantity: item.quantity,
    condition: 'gut',
    reason: 'gefaellt_nicht',
    resolution: 'erstattung',
    notes: '',
  }
}

export default function ErfassenScreen({ order }: { order: Order }) {
  const router = useRouter()
  const [captures, setCaptures] = useState<ReturnItemCapture[]>(
    order.items.map((item) => defaultItemCapture(item))
  )
  const [packageService, setPackageService] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')

  const returnedCount = captures.filter((c) => c.returned).length

  function updateCapture(index: number, patch: Partial<ReturnItemCapture>) {
    setCaptures((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function handleContinue() {
    const capture = {
      orderId: order.id,
      order,
      items: captures,
      packageService,
      trackingNumber,
      notes,
    }
    localStorage.setItem('return_capture', JSON.stringify(capture))
    router.push(`/order/${order.id}/fotos`)
  }

  return (
    <>
      <header className="page-header">
        <Link
          href={`/order/${order.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', padding: '8px 4px' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 14 }}>Bestellung</span>
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Positionen erfassen</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          #{order.orderNumber}
        </span>
      </header>

      {/* Step indicator */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', gap: 6 }}>
        {['Positionen', 'Fotos', 'Senden'].map((step, i) => (
          <div
            key={step}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: i === 0 ? 'var(--purple)' : 'var(--text-faint)',
              fontWeight: i === 0 ? 600 : 400,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: i === 0 ? 'var(--purple)' : 'var(--surface-3)',
                color: i === 0 ? '#fff' : 'var(--text-faint)',
              }}
            >
              {i + 1}
            </div>
            {step}
            {i < 2 && <span style={{ color: 'var(--border)', marginLeft: 2 }}>›</span>}
          </div>
        ))}
      </div>

      <div className="page-content">
        <div className="section-title" style={{ marginBottom: 12 }}>Artikel</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {order.items.map((item, i) => {
            const capture = captures[i]
            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface)',
                  border: `1.5px solid ${capture.returned ? 'var(--purple-border)' : 'var(--border)'}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Article header row */}
                <label
                  style={{
                    display: 'flex',
                    gap: 14,
                    padding: '16px 18px',
                    cursor: 'pointer',
                    background: capture.returned ? 'var(--purple-bg)' : 'transparent',
                    transition: 'background 0.15s',
                    alignItems: 'flex-start',
                  }}
                >
                  <input
                    type="checkbox"
                    className="check-toggle"
                    checked={capture.returned}
                    onChange={(e) => updateCapture(i, { returned: e.target.checked })}
                    style={{ marginTop: 2 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, lineHeight: 1.3 }}>
                      {item.productName}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', display: 'flex', gap: 10 }}>
                      {item.sku && <span style={{ fontFamily: 'var(--font-mono)' }}>{item.sku}</span>}
                      <span>Bestellt: {item.quantity}×</span>
                      <span>{item.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                  </div>
                  {!capture.returned && (
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
                          onClick={() => updateCapture(i, { returnedQuantity: Math.max(1, capture.returnedQuantity - 1) })}
                        >−</button>
                        <span className="qty-val">{capture.returnedQuantity}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => updateCapture(i, { returnedQuantity: Math.min(item.quantity, capture.returnedQuantity + 1) })}
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
                          onChange={(e) => updateCapture(i, { condition: e.target.value as ReturnCondition })}
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
                          onChange={(e) => updateCapture(i, { reason: e.target.value as ReturnReason })}
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
                            onClick={() => updateCapture(i, { resolution: r.value })}
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
                        onChange={(e) => updateCapture(i, { notes: e.target.value })}
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
          })}
        </div>

        {/* Package info */}
        <div className="section-title" style={{ marginBottom: 12 }}>Sendungsdetails</div>
        <div className="card-section" style={{ marginBottom: 28 }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-2)' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              PAKETDIENST
            </label>
            <select
              className="select"
              value={packageService}
              onChange={(e) => setPackageService(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">— wählen —</option>
              <option value="DHL">DHL</option>
              <option value="DPD">DPD</option>
              <option value="UPS">UPS</option>
              <option value="GLS">GLS</option>
              <option value="Hermes">Hermes</option>
              <option value="FedEx">FedEx</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-2)' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              TRACKING-NUMMER (optional)
            </label>
            <input
              className="input"
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="z. B. 1Z999AA10123456784"
            />
          </div>
          <div style={{ padding: '16px 18px' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              ALLGEMEINE BEMERKUNGEN (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. Paket war ohne Inhalt"
              rows={3}
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

        {returnedCount === 0 && (
          <div style={{ border: '1px solid var(--gold-border)', background: 'var(--gold-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 14, color: 'var(--gold-dark)' }}>
            Bitte mindestens einen Artikel als zurückgekommen markieren.
          </div>
        )}

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleContinue}
          disabled={returnedCount === 0}
          style={{ marginBottom: 12, opacity: returnedCount === 0 ? 0.5 : 1 }}
        >
          Weiter zu Fotos →
        </button>
        <Link href={`/order/${order.id}`} className="btn btn-secondary btn-full" style={{ display: 'flex' }}>
          Abbrechen
        </Link>
      </div>
    </>
  )
}
