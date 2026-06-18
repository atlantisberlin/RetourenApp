'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReturnCapture } from '@/lib/types'
import { StepIndicator } from './FotosScreen'

const CONDITION_LABELS: Record<string, string> = {
  gut: 'Gut',
  beschaedigt: 'Beschädigt',
  unvollstaendig: 'Unvollständig',
  defekt: 'Defekt',
}

const REASON_LABELS: Record<string, string> = {
  gefaellt_nicht: 'Gefällt nicht',
  falsch_geliefert: 'Falsch geliefert',
  defekt_bei_ankunft: 'Defekt bei Ankunft',
  groesse_passt_nicht: 'Größe passt nicht',
  beschaedigt_bei_lieferung: 'Beschädigt bei Lieferung',
  sonstiges: 'Sonstiges',
}

export default function ZusammenfassungScreen({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [capture, setCapture] = useState<ReturnCapture | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'live' | 'demo'>('demo')

  useEffect(() => {
    const raw = localStorage.getItem('return_capture')
    if (raw) {
      try {
        setCapture(JSON.parse(raw))
      } catch {
        router.push(`/order/${orderId}`)
      }
    } else {
      router.push(`/order/${orderId}`)
    }
  }, [orderId, router])

  async function handleSubmit() {
    if (!capture) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capture),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unbekannter Fehler')
      setTaskId(data.taskId)
      setMode(data.mode)
      setSubmitted(true)
      localStorage.removeItem('return_capture')
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (!capture) {
    return (
      <div className="empty-state" style={{ marginTop: 80 }}>
        <p>Lade Daten…</p>
      </div>
    )
  }

  if (submitted) {
    return <SuccessScreen taskId={taskId} mode={mode} />
  }

  const returnedItems = capture.items.filter((i) => i.returned)
  const photoCount = (capture as ReturnCapture & { photos?: unknown[] }).photos?.length ?? 0

  // Build Asana title preview
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  const asanaTitle = `Retoure – ${capture.order.source ?? 'Atlantis'} – ${date} – ${capture.order.orderNumber} – ${capture.order.customerName}`

  return (
    <>
      <header className="page-header">
        <Link
          href={`/order/${orderId}/fotos`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', padding: '8px 4px' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 14 }}>Fotos</span>
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Zusammenfassung</span>
      </header>

      <StepIndicator current={2} />

      <div className="page-content">
        {/* Asana task preview */}
        <div className="section-title" style={{ marginBottom: 10 }}>Asana-Aufgabe</div>
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: '3px solid var(--blue)',
            borderRadius: '0 14px 14px 0',
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--blue-dark)', marginBottom: 8, letterSpacing: '0.08em' }}>AUFGABEN-TITEL</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {asanaTitle}
          </div>
        </div>

        {/* Order summary */}
        <div className="section-title" style={{ marginBottom: 10 }}>Bestellung</div>
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 14 }}>
            <SummaryRow label="Kunde" value={capture.order.customerName} />
            <SummaryRow label="Bestellnr." value={capture.order.orderNumber} mono />
            <SummaryRow label="Kundennr." value={capture.order.customerNumber} mono />
            {capture.order.invoiceNumber && (
              <SummaryRow label="Rechnungsnr." value={capture.order.invoiceNumber} mono />
            )}
            {capture.packageService && (
              <SummaryRow label="Paketdienst" value={capture.packageService} />
            )}
            {capture.trackingNumber && (
              <SummaryRow label="Tracking" value={capture.trackingNumber} mono />
            )}
          </div>
        </div>

        {/* Returned items */}
        <div className="section-title" style={{ marginBottom: 10 }}>
          {returnedItems.length} zurückgekommene {returnedItems.length === 1 ? 'Position' : 'Positionen'}
        </div>
        <div className="card-section" style={{ marginBottom: 20 }}>
          {returnedItems.map((item, i) => {
            const orderItem = capture.order.items.find((oi) => oi.id === item.itemId)
            return (
              <div key={item.itemId}>
                {i > 0 && <hr />}
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, lineHeight: 1.3 }}>
                    {orderItem?.productName ?? item.itemId}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span className="badge badge-neutral">{item.returnedQuantity}×</span>
                    <span className="badge badge-blue">{CONDITION_LABELS[item.condition]}</span>
                    <span className="badge badge-neutral">{REASON_LABELS[item.reason]}</span>
                    <span className={`badge ${item.resolution === 'erstattung' ? 'badge-green' : 'badge-purple'}`}>
                      {item.resolution === 'erstattung' ? 'Erstattung' : 'Umtausch'}
                    </span>
                  </div>
                  {item.notes && (
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                      {item.notes}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Photos count */}
        {photoCount > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-3)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M5.5 2L4 4H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2L10.5 2h-5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
              <circle cx="8" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
            </svg>
            {photoCount} {photoCount === 1 ? 'Foto' : 'Fotos'} angehängt
          </div>
        )}

        {capture.notes && (
          <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text-2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>BEMERKUNGEN</span>
            {capture.notes}
          </div>
        )}

        {error && (
          <div style={{ border: '1px solid var(--red-border)', background: 'var(--red-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 14, color: 'var(--red-dark)' }}>
            Fehler: {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ marginBottom: 12, opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? (
            <>
              <Spinner />
              Wird übermittelt…
            </>
          ) : (
            <>
              <AsanaIcon />
              An Asana senden
            </>
          )}
        </button>
        <Link href={`/order/${orderId}/fotos`} className="btn btn-secondary btn-full" style={{ display: 'flex' }}>
          Zurück zu Fotos
        </Link>
      </div>
    </>
  )
}

function SuccessScreen({ taskId, mode }: { taskId: string | null; mode: 'live' | 'demo' }) {
  return (
    <>
      <header className="page-header">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Atlantis</span>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Retouren-App</span>
      </header>
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--green-bg)',
          border: '2px solid var(--green-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 16l5.5 5.5L24 10" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Retoure übermittelt</h2>
        <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5, maxWidth: '28ch' }}>
          {mode === 'demo'
            ? 'Demo-Modus: Asana ist nicht konfiguriert. Die Aufgabe würde jetzt angelegt.'
            : 'Die Asana-Aufgabe wurde im Projekt „Retoureneingang" angelegt.'}
        </p>
        {taskId && mode === 'live' && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
            Task-ID: {taskId}
          </div>
        )}
        {mode === 'demo' && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold-dark)', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '8px 14px', marginBottom: 24 }}>
            Demo-Modus · {taskId}
          </div>
        )}
        <Link href="/" className="btn btn-primary btn-lg" style={{ minWidth: 200 }}>
          Neue Retoure erfassen
        </Link>
      </div>
    </>
  )
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontFamily: mono ? 'var(--font-mono)' : undefined, color: 'var(--text-2)' }}>
        {value}
      </div>
    </div>
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

function AsanaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="6" r="3" fill="white" opacity="0.9"/>
      <circle cx="4" cy="12" r="3" fill="white" opacity="0.7"/>
      <circle cx="14" cy="12" r="3" fill="white" opacity="0.7"/>
    </svg>
  )
}
