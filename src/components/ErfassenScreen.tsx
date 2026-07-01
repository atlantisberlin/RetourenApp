'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Order, ReturnItemCapture } from '@/lib/types'
import { getOperator, refreshActivity } from '@/lib/operator'
import { ErfassenItemCard } from '@/components/ErfassenItemCard'

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
  const [skipPackageWarning, setSkipPackageWarning] = useState(false)

  const returnedCount = captures.filter((c) => c.returned).length

  function updateCapture(index: number, patch: Partial<ReturnItemCapture>) {
    setCaptures((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function handleContinue(force = false) {
    if (!force && packageService === '' && !skipPackageWarning) {
      setSkipPackageWarning(true)
      return
    }
    refreshActivity()
    const capture = {
      orderId: order.id,
      order,
      items: captures,
      packageService,
      trackingNumber,
      notes,
      operatorName: getOperator() ?? 'Unbekannt',
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
          {order.items.map((item, i) => (
            <ErfassenItemCard
              key={item.id}
              item={item}
              capture={captures[i]}
              onUpdateCapture={(patch) => updateCapture(i, patch)}
            />
          ))}
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

        {skipPackageWarning && (
          <div style={{ border: '1.5px solid var(--gold-border)', background: 'var(--gold-bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--gold-dark)' }}>Kein Paketdienst ausgewählt — trotzdem weiter?</span>
            <button className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 12px', flexShrink: 0 }} onClick={() => handleContinue(true)}>Ja, weiter</button>
          </div>
        )}

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={() => handleContinue()}
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
