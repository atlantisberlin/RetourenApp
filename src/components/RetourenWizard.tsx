'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getOperator, refreshActivity } from '@/lib/operator'
import { addToHistory } from '@/lib/history'
import { apiPost } from '@/lib/api-client'
import type { ApiResponse } from '@/lib/api-response'
import type { Order, OrderItem, ReturnCapture, ReturnCondition, ReturnReason, ReturnResolution, ReplacementProduct } from '@/lib/types'
import UserSelectionScreen from '@/components/UserSelectionScreen'
import { ArticleRow, type ArticleCapture } from '@/components/retouren-wizard/ArticleRow'
import { CameraIcon, SearchSpinner, ButtonSpinner, AsanaIcon } from '@/components/retouren-wizard/icons'

type Photo = { id: string; dataUrl: string; name: string; type: string }

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

const STEP_LABELS = ['PAKET', 'ÖFFNEN', 'ARTIKEL', 'SENDEN']
const DRAFT_KEY = 'retouren_draft'

export default function RetourenWizard() {
  const router = useRouter()
  const [operatorChecked, setOperatorChecked] = useState(false)
  const [operator, setOperator] = useState<string | null>(null)
  const [step, setStep] = useState(1)

  // Step 1
  const [trackingNumber, setTrackingNumber] = useState('')
  const [isDhlReturn, setIsDhlReturn] = useState<boolean | null>(null)
  const [labelPhoto, setLabelPhoto] = useState<Photo | null>(null)
  const [exteriorPhoto, setExteriorPhoto] = useState<Photo | null>(null)

  // Step 2
  const [slipPhoto, setSlipPhoto] = useState<Photo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Order[]>([])
  const [searchMode, setSearchMode] = useState('')
  const [searching, setSearching] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Step 3
  const [articles, setArticles] = useState<ArticleCapture[]>([])

  // Step 4
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [submitMode, setSubmitMode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const photoTargetRef = useRef<'label' | 'exterior' | 'slip' | number>('label')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingArticlesRef = useRef<Array<Omit<ArticleCapture, 'photo'>> | null>(null)

  // Load draft + operator on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOperator(getOperator())
    setOperatorChecked(true)
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.step > 1 || d.trackingNumber) {
          if (d.trackingNumber) setTrackingNumber(d.trackingNumber)
          if (d.step) setStep(d.step)
          if (d.notes) setNotes(d.notes)
          if (d.isDhlReturn != null) setIsDhlReturn(d.isDhlReturn)
          if (d.selectedOrder) {
            pendingArticlesRef.current = d.articles ?? null
            setSelectedOrder(d.selectedOrder)
          }
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Rebuild articles when order is selected; merge saved status if restoring draft
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedOrder) { setArticles([]); return }
    const rebuilt = selectedOrder.items.map((item: OrderItem) => ({
      itemId: item.id,
      productName: item.productName,
      imageUrl: item.imageUrl,
      orderedQty: item.quantity,
      returned: null as boolean | null,
      returnedQuantity: null as number | null,
      condition: null as string | null,
      reason: null as string | null,
      resolution: null as 'erstattung' | 'umtausch' | null,
      replacementProduct: null as ReplacementProduct | null,
      photo: null as Photo | null,
      existingRetoure: item.existingRetoure ?? null,
      existingGutschrift: item.existingGutschrift ?? null,
    }))
    if (pendingArticlesRef.current) {
      const saved = pendingArticlesRef.current
      pendingArticlesRef.current = null
      setArticles(rebuilt.map(a => {
        const s = saved.find(x => x.itemId === a.itemId)
        return s ? { ...a, returned: s.returned, condition: s.condition, reason: s.reason } : a
      }))
    } else {
      setArticles(rebuilt)
    }
  }, [selectedOrder])

  // Save draft whenever meaningful state changes (photos excluded — too large)
  useEffect(() => {
    if (!trackingNumber && !selectedOrder && step === 1) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        step,
        trackingNumber,
        isDhlReturn,
        selectedOrder,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        articles: articles.map(({ photo, ...rest }) => rest),
        notes,
        savedAt: new Date().toISOString(),
      }))
    } catch { /* ignore */ }
  }, [step, trackingNumber, isDhlReturn, selectedOrder, articles, notes])

  const isStep1Valid = trackingNumber.trim().length > 3
  const isStep2Valid = selectedOrder !== null
  const isStep3Valid = articles.length > 0 &&
    articles.every(a => a.returned !== null || !!a.existingGutschrift) &&
    articles.filter(a => a.returned === true).every(a => a.condition !== null && a.reason !== null && a.resolution !== null)
  const isNextEnabled = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : step === 3 ? isStep3Valid : true

  const handleNext = () => {
    refreshActivity()
    if (step < 4) setStep(step + 1)
    else handleSubmit()
  }

  const handleBack = () => {
    refreshActivity()
    if (step === 1) {
      localStorage.removeItem(DRAFT_KEY)
      router.push('/')
    } else {
      setStep(step - 1)
    }
  }

  const capturePhoto = (target: 'label' | 'exterior' | 'slip' | number) => {
    refreshActivity()
    photoTargetRef.current = target
    fileRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const photo: Photo = { id: Date.now().toString(), dataUrl: ev.target?.result as string, name: file.name, type: file.type }
      const t = photoTargetRef.current
      if (t === 'label') setLabelPhoto(photo)
      else if (t === 'exterior') setExteriorPhoto(photo)
      else if (t === 'slip') setSlipPhoto(photo)
      else if (typeof t === 'number') setArticles(prev => prev.map((a, i) => i === t ? { ...a, photo } : a))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSearchChange = (q: string) => {
    refreshActivity()
    setSearchQuery(q)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(q))
        const data = await res.json()
        setSearchResults(data.orders ?? [])
        setSearchMode(data.mode ?? '')
      } catch { /* ignore */ }
      setSearching(false)
    }, 350)
  }

  const updateArticle = (idx: number, patch: Partial<ArticleCapture>) => {
    refreshActivity()
    setArticles(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a))
  }

  const handleSubmit = async () => {
    if (!selectedOrder || submitting) return
    setSubmitting(true)
    setError(null)
    refreshActivity()
    try {
      const body: ReturnCapture = {
        orderId: selectedOrder.id,
        order: selectedOrder,
        items: articles.map(a => ({
          itemId: a.itemId,
          returned: a.returned === true,
          returnedQuantity: a.returned === true ? (a.returnedQuantity ?? a.orderedQty) : 0,
          condition: (a.condition ?? 'gut') as ReturnCondition,
          reason: (a.reason ?? 'sonstiges') as ReturnReason,
          resolution: (a.resolution ?? 'erstattung') as ReturnResolution,
          notes: '',
          replacementProduct: a.replacementProduct ?? null,
        })),
        trackingNumber: trackingNumber.trim(),
        packageService: '',
        notes: notes.trim(),
        operatorName: operator ?? 'Unbekannt',
        dhlReturn: isDhlReturn === true,
        photos: [labelPhoto, exteriorPhoto, slipPhoto, ...articles.map(a => a.photo)].filter((p): p is Photo => p !== null),
      }
      const response = await apiPost<{ mode: string; taskId: string }>('/api/submit', body)
      const resp = response as ApiResponse<{ mode: string; taskId: string }>
      if (!resp.success) {
        throw new Error(resp.error || 'Submission failed')
      }
      const data = resp.data
      localStorage.removeItem(DRAFT_KEY)
      addToHistory({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        customerName: selectedOrder.customerName,
        customerNumber: selectedOrder.customerNumber,
        operatorName: operator ?? 'Unbekannt',
        submittedAt: new Date().toISOString(),
        itemCount: articles.filter(a => a.returned === true).length,
        items: articles.filter(a => a.returned === true).map(a => ({
          productName: a.productName,
          condition: a.condition ?? 'gut',
          reason: a.reason ?? 'sonstiges',
          resolution: 'erstattung',
        })),
        taskId: data.taskId,
      })
      setTaskId(data.taskId)
      setSubmitMode(data.mode)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    }
    setSubmitting(false)
  }

  if (!operatorChecked) return null
  if (!operator) return <UserSelectionScreen onSelect={(name) => setOperator(name)} />

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', backgroundColor: 'var(--surface-2)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Retoure dokumentiert</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: submitMode === 'demo' ? 8 : 32, textAlign: 'center' }}>
          Die Retoure wurde erfolgreich erfasst und an Asana übermittelt.
        </p>
        {submitMode === 'demo' && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold-dark)', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '8px 14px', marginBottom: 32 }}>
            Demo-Modus · {taskId}
          </div>
        )}
        {submitMode === 'live' && taskId && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 32 }}>Task-ID: {taskId}</div>
        )}
        <button className="btn btn-primary btn-lg btn-full" style={{ maxWidth: 320, marginBottom: 12 }} onClick={() => {
          localStorage.removeItem(DRAFT_KEY)
          setStep(1); setTrackingNumber(''); setIsDhlReturn(null); setLabelPhoto(null); setExteriorPhoto(null); setSlipPhoto(null)
          setSearchQuery(''); setSearchResults([]); setSelectedOrder(null); setArticles([])
          setNotes(''); setSubmitted(false); setTaskId(null); setError(null)
        }}>
          Neue Retoure
        </button>
        <button className="btn btn-secondary btn-full" style={{ maxWidth: 320 }} onClick={() => router.push('/')}>
          Zur Startseite
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface-2)' }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* HEADER */}
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 14, padding: '4px 0', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          {step === 1 ? 'Startseite' : 'Zurück'}
        </button>
        <div style={{ width: 1, height: 16, backgroundColor: 'var(--border)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 15, flex: 1, color: 'var(--text)' }}>Retoure erfassen</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{step}/4</span>
      </header>

      {/* PROGRESS */}
      <div style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[1, 2, 3, 4].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                ...(i < step - 1 ? { backgroundColor: 'var(--green)' } : i === step - 1 ? { backgroundColor: 'var(--blue)', boxShadow: '0 0 0 3px var(--blue-bg)' } : { backgroundColor: 'var(--surface-3)', border: '1.5px solid var(--border)' }),
              }}>
                {i < step - 1
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  : <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: i === step - 1 ? 'white' : 'var(--text-muted)' }}>{s}</span>
                }
              </div>
              {i < 3 && <div style={{ flex: 1, height: 2, backgroundColor: i < step - 1 ? 'var(--green)' : 'var(--border)' }} />}
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 6 }}>
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <div style={{ width: 24, position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontFamily: 'var(--font-mono)', color: i === step - 1 ? 'var(--blue)' : i < step - 1 ? 'var(--green)' : 'var(--text-muted)', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontWeight: i === step - 1 ? 600 : 400 }}>
                  {label}
                </div>
              </div>
              {i < 3 && <div style={{ flex: 1 }} />}
            </React.Fragment>
          ))}
        </div>
        <div style={{ height: 16 }} />
      </div>

      {/* CONTENT */}
      <div className="page-content" style={{ flex: 1, paddingBottom: 100 }}>

        {/* ── STEP 1: Photos + Tracking ── */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Paket dokumentieren</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>Fotos aufnehmen, bevor du das Paket öffnest.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {([
                { key: 'label' as const, label: 'Adressetikett', photo: labelPhoto },
                { key: 'exterior' as const, label: 'Paket außen', photo: exteriorPhoto },
              ]).map(({ key, label, photo }) => (
                <div key={key} onClick={() => capturePhoto(key)} style={{ border: `1.5px ${photo ? 'solid var(--green-border)' : 'dashed var(--border)'}`, borderRadius: 12, background: photo ? 'var(--green-bg)' : 'var(--surface)', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 110, justifyContent: 'center' }}>
                  {photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={photo.dataUrl} alt={label} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                    : <div style={{ color: 'var(--text-muted)' }}><CameraIcon size={28} /></div>
                  }
                  <div style={{ fontSize: 12, fontWeight: 500, color: photo ? 'var(--green)' : 'var(--text-2)', textAlign: 'center' }}>{label}</div>
                  <div style={{ fontSize: 11, color: photo ? 'var(--green)' : 'var(--text-muted)' }}>{photo ? '✓ Aufgenommen' : 'Foto aufnehmen'}</div>
                </div>
              ))}
            </div>

            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
              TRACKING-NUMMER <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              className="input"
              type="text"
              value={trackingNumber}
              onChange={e => { refreshActivity(); setTrackingNumber(e.target.value) }}
              placeholder="z. B. 1Z999AA10123456784"
              autoFocus
              autoComplete="off"
              style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}
            />

            {/* DHL Return Label toggle */}
            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                DHL RETOURENLABEL?
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { refreshActivity(); setIsDhlReturn(true) }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${isDhlReturn === true ? 'var(--blue)' : 'var(--border)'}`,
                    background: isDhlReturn === true ? 'var(--blue)' : 'var(--surface)',
                    color: isDhlReturn === true ? 'white' : 'var(--text-3)',
                    transition: 'all 0.12s',
                  }}
                >
                  Ja — DHL Retoure
                </button>
                <button
                  type="button"
                  onClick={() => { refreshActivity(); setIsDhlReturn(false) }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${isDhlReturn === false ? 'var(--border)' : 'var(--border)'}`,
                    background: isDhlReturn === false ? 'var(--surface-3)' : 'var(--surface)',
                    color: isDhlReturn === false ? 'var(--text-2)' : 'var(--text-muted)',
                    transition: 'all 0.12s',
                  }}
                >
                  Nein
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Slip Photo + Order Search ── */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Paket öffnen</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>Retourenschein fotografieren und Bestellung suchen.</p>
            </div>

            {/* Slip photo */}
            <div onClick={() => capturePhoto('slip')} style={{ display: 'flex', alignItems: 'center', gap: 14, border: `1.5px ${slipPhoto ? 'solid var(--green-border)' : 'dashed var(--border)'}`, borderRadius: 12, background: slipPhoto ? 'var(--green-bg)' : 'var(--surface)', padding: '14px 16px', cursor: 'pointer', marginBottom: 20 }}>
              {slipPhoto
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={slipPhoto.dataUrl} alt="Retourenschein" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
                : <div style={{ width: 52, height: 52, borderRadius: 8, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}><CameraIcon size={22} /></div>
              }
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginBottom: 2 }}>Retourenschein</div>
                <div style={{ fontSize: 12, color: slipPhoto ? 'var(--green)' : 'var(--text-muted)' }}>
                  {slipPhoto ? `✓ ${slipPhoto.name}` : 'Lieferschein oder Retourenzettel fotografieren'}
                </div>
              </div>
            </div>

            {/* Order search */}
            {selectedOrder ? (
              <div>
                <div style={{ padding: '16px 18px', background: 'var(--surface)', border: '2px solid var(--blue)', borderRadius: 14, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {selectedOrder.customerName}
                        {selectedOrder.partnershop === 'amazon' && (
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: '#ff9900', color: '#000', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>AMAZON</span>
                        )}
                        {selectedOrder.partnershop === 'ebay' && (
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: '#e43137', color: '#fff', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>EBAY</span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                        #{selectedOrder.orderNumber}{selectedOrder.customerNumber ? ` · KD ${selectedOrder.customerNumber}` : ''}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedOrder(null); setSearchQuery('') }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-3)', padding: '4px 10px' }}>
                      Ändern
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {selectedOrder.items.map(item => (
                      <span key={item.id} style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 5, padding: '2px 7px' }}>{item.productName}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
                  {selectedOrder.items.length} Artikel · {selectedOrder.date}
                  {searchMode === 'demo' && <span className="badge badge-gold" style={{ marginLeft: 8 }}>Demo</span>}
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                  BESTELLNR. ODER KUNDENNR. <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <div className="input-wrap input-icon-left" style={{ marginBottom: 12 }}>
                  <svg className="input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M14 14l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input className="input" type="search" value={searchQuery} onChange={e => handleSearchChange(e.target.value)} placeholder="Bestellnr., Name, Kundennr. …" autoFocus autoComplete="off" />
                </div>
                {searching && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                    <SearchSpinner /> Suche läuft…
                  </div>
                )}
                {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                    Keine Bestellungen gefunden für &ldquo;{searchQuery}&rdquo;
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="section-title" style={{ marginBottom: 4 }}>
                      {searchResults.length} Treffer
                      {searchMode === 'demo' && <span className="badge badge-gold" style={{ marginLeft: 8 }}>Demo</span>}
                    </div>
                    {searchResults.map(order => (
                      <button key={order.id} onClick={() => { refreshActivity(); setSelectedOrder(order) }}
                        style={{ all: 'unset', display: 'block', cursor: 'pointer', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--blue)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {order.customerName}
                            {order.partnershop === 'amazon' && (
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: '#ff9900', color: '#000', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>AMAZON</span>
                            )}
                            {order.partnershop === 'ebay' && (
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: '#e43137', color: '#fff', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>EBAY</span>
                            )}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{order.date}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                          #{order.orderNumber}{order.customerNumber ? ` · KD ${order.customerNumber}` : ''}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {order.items.slice(0, 2).map(item => (
                            <span key={item.id} style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 4, padding: '1px 6px' }}>{item.productName}</span>
                          ))}
                          {order.items.length > 2 && <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '1px 4px' }}>+{order.items.length - 2}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Article list ── */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Artikel prüfen</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Welche Artikel wurden zurückgeschickt?
              </p>
            </div>

            {/* Summary pill */}
            {articles.some(a => a.returned !== null) && (
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 12 }}>
                {articles.filter(a => a.returned === true).length} von {articles.length} zurückgekommen
                {articles.filter(a => a.returned === null).length > 0 && (
                  <span style={{ color: 'var(--gold)' }}> · {articles.filter(a => a.returned === null).length} noch offen</span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {articles.map((art, idx) => (
                <ArticleRow
                  key={art.itemId}
                  article={art}
                  onToggleReturned={(val) => updateArticle(idx, val ? { returned: true } : { returned: false, returnedQuantity: null, condition: null, reason: null, resolution: null, replacementProduct: null, photo: null })}
                  onQuantity={(val) => updateArticle(idx, { returnedQuantity: val })}
                  onCondition={(val) => updateArticle(idx, { condition: val })}
                  onReason={(val) => updateArticle(idx, { reason: val })}
                  onResolution={(val) => updateArticle(idx, { resolution: val })}
                  onReplacementProduct={(val) => updateArticle(idx, { replacementProduct: val })}
                  onCapturePhoto={() => capturePhoto(idx)}
                  onRemovePhoto={() => updateArticle(idx, { photo: null })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 4: Summary + Notes + Submit ── */}
        {step === 4 && selectedOrder && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Abschließen</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>Zusammenfassung prüfen und absenden.</p>
            </div>

            {/* Summary card */}
            <div style={{ marginBottom: 20, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              {([
                { label: 'TRACKING', val: <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{trackingNumber}</span> },
                { label: 'BESTELLUNG', val: `${selectedOrder.customerName} · #${selectedOrder.orderNumber}` },
                { label: 'RETOUREN', val: `${articles.filter(a => a.returned === true).length} von ${articles.length} Artikel` },
                { label: 'FOTOS', val: `${[labelPhoto, exteriorPhoto, slipPhoto, ...articles.map(a => a.photo)].filter(Boolean).length} Aufnahmen` },
                { label: 'MITARBEITER', val: operator },
              ] as { label: string; val: React.ReactNode }[]).map(({ label, val }, i, arr) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right' as const, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Returned articles detail */}
            {articles.filter(a => a.returned === true).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>ZURÜCKGEKOMMEN</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {articles.filter(a => a.returned === true).map(a => (
                    <div key={a.itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.productName}</div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-muted)' }}>
                          {CONDITIONS.find(c => c.value === a.condition)?.label}
                        </span>
                        <span style={{ fontSize: 11, background: 'var(--blue-bg)', border: '1px solid var(--blue-border)', borderRadius: 4, padding: '2px 6px', color: 'var(--blue)' }}>
                          {REASONS.find(r => r.value === a.reason)?.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>BEMERKUNGEN (OPTIONAL)</label>
              <textarea
                value={notes}
                onChange={e => { refreshActivity(); setNotes(e.target.value) }}
                placeholder="z. B. Paket war beschädigt, Inhalt vollständig"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--text)', background: 'var(--surface)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Asana-Tags Vorschau */}
            {(isDhlReturn || selectedOrder.partnershop === 'amazon' || selectedOrder.partnershop === 'ebay') && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>ASANA-TAGS</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {isDhlReturn && (
                    <span style={{ fontSize: 12, fontWeight: 700, background: '#FFCC00', color: '#000', borderRadius: 5, padding: '3px 10px' }}>DHL Retoure</span>
                  )}
                  {selectedOrder.partnershop === 'amazon' && (
                    <span style={{ fontSize: 12, fontWeight: 700, background: '#FF9900', color: '#000', borderRadius: 5, padding: '3px 10px' }}>Amazon</span>
                  )}
                  {selectedOrder.partnershop === 'ebay' && (
                    <span style={{ fontSize: 12, fontWeight: 700, background: '#E43137', color: '#fff', borderRadius: 5, padding: '3px 10px' }}>eBay</span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div style={{ border: '1px solid var(--red-border)', background: 'var(--red-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 14, color: 'var(--red-dark)' }}>
                Fehler: {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', gap: 10, zIndex: 10 }}>
        <button className="btn btn-secondary" onClick={handleBack} style={{ flex: '0 0 auto', minWidth: 80 }}>
          {step === 1 ? 'Abbrechen' : 'Zurück'}
        </button>
        <button className="btn btn-primary" onClick={handleNext} disabled={!isNextEnabled || submitting} style={{ flex: 1, opacity: !isNextEnabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {step === 4
            ? submitting ? <><ButtonSpinner /> Wird gesendet…</> : <><AsanaIcon /> An Asana senden</>
            : 'Weiter'
          }
        </button>
      </div>
    </div>
  )
}
