'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getOperator, refreshActivity } from '@/lib/operator'
import { addToHistory } from '@/lib/history'
import type { Order, OrderItem, ReturnCapture, ReturnCondition, ReturnReason, ReturnResolution } from '@/lib/types'
import UserSelectionScreen from '@/components/UserSelectionScreen'

type Photo = { id: string; dataUrl: string; name: string; type: string }

type ArticleCapture = {
  itemId: string
  productName: string
  orderedQty: number
  returned: boolean | null
  condition: string | null
  reason: string | null
  photo: Photo | null
}

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

export default function RetourenWizard() {
  const router = useRouter()
  const [operatorChecked, setOperatorChecked] = useState(false)
  const [operator, setOperator] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Order[]>([])
  const [searchMode, setSearchMode] = useState<string>('')
  const [searching, setSearching] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [articles, setArticles] = useState<ArticleCapture[]>([])
  const [currentArticleIdx, setCurrentArticleIdx] = useState(0)
  const [labelPhoto, setLabelPhoto] = useState<Photo | null>(null)
  const [exteriorPhoto, setExteriorPhoto] = useState<Photo | null>(null)
  const [slipPhoto, setSlipPhoto] = useState<Photo | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [submitMode, setSubmitMode] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoTargetRef = useRef<'label' | 'exterior' | 'slip' | 'article'>('label')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const op = getOperator()
    setOperator(op)
    setOperatorChecked(true)
  }, [])

  useEffect(() => {
    if (!selectedOrder) { setArticles([]); return }
    setArticles(selectedOrder.items.map((item: OrderItem) => ({
      itemId: item.id,
      productName: item.productName,
      orderedQty: item.quantity,
      returned: null,
      condition: null,
      reason: null,
      photo: null,
    })))
    setCurrentArticleIdx(0)
  }, [selectedOrder])

  const isStep1Valid = trackingNumber.trim().length > 3
  const isStep2Valid = selectedOrder !== null
  const currentArticle = articles[currentArticleIdx] ?? null
  const isStep3Valid = currentArticle !== null &&
    currentArticle.returned !== null &&
    (currentArticle.returned === false || (currentArticle.condition !== null && currentArticle.reason !== null))

  const handleNext = () => {
    refreshActivity()
    if (step === 1) setStep(2)
    else if (step === 2) setStep(3)
    else if (step === 3) {
      if (currentArticleIdx < articles.length - 1) setCurrentArticleIdx(currentArticleIdx + 1)
      else setStep(4)
    } else if (step === 4) handleSubmit()
  }

  const handleBack = () => {
    refreshActivity()
    if (step === 1) router.push('/')
    else if (step === 2) setStep(1)
    else if (step === 3) {
      if (currentArticleIdx > 0) setCurrentArticleIdx(currentArticleIdx - 1)
      else setStep(2)
    } else if (step === 4) {
      setStep(3)
      setCurrentArticleIdx(articles.length - 1)
    }
  }

  const capturePhoto = (target: 'label' | 'exterior' | 'slip' | 'article') => {
    refreshActivity()
    photoTargetRef.current = target
    fileRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const photo: Photo = {
        id: Date.now().toString(),
        dataUrl: ev.target?.result as string,
        name: file.name,
        type: file.type,
      }
      const target = photoTargetRef.current
      if (target === 'label') setLabelPhoto(photo)
      else if (target === 'exterior') setExteriorPhoto(photo)
      else if (target === 'slip') setSlipPhoto(photo)
      else if (target === 'article') {
        setArticles(prev => prev.map((a, i) => i === currentArticleIdx ? { ...a, photo } : a))
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSearchChange = (query: string) => {
    refreshActivity()
    setSearchQuery(query)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (query.trim().length < 2) { setSearchResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(query))
        const data = await res.json()
        setSearchResults(data.orders ?? [])
        setSearchMode(data.mode ?? '')
      } catch { /* ignore */ }
      setSearching(false)
    }, 350)
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
          returnedQuantity: a.returned === true ? a.orderedQty : 0,
          condition: (a.condition ?? 'gut') as ReturnCondition,
          reason: (a.reason ?? 'sonstiges') as ReturnReason,
          resolution: 'erstattung' as ReturnResolution,
          notes: '',
        })),
        trackingNumber: trackingNumber.trim(),
        packageService: '',
        notes: notes.trim(),
        operatorName: operator ?? 'Unbekannt',
        photos: [labelPhoto, exteriorPhoto, slipPhoto, ...articles.map(a => a.photo)].filter((p): p is Photo => p !== null),
      }
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Senden')
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

  const updateArticle = (idx: number, patch: Partial<ArticleCapture>) => {
    refreshActivity()
    setArticles(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a))
  }

  if (!operatorChecked) return null
  if (!operator) {
    return <UserSelectionScreen onSelect={(name) => setOperator(name)} />
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', backgroundColor: 'var(--surface-2)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
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
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 32 }}>
            Task-ID: {taskId}
          </div>
        )}
        <button
          className="btn btn-primary btn-lg btn-full"
          style={{ maxWidth: 320, marginBottom: 12 }}
          onClick={() => {
            setStep(1)
            setTrackingNumber('')
            setSearchQuery('')
            setSearchResults([])
            setSelectedOrder(null)
            setArticles([])
            setLabelPhoto(null)
            setExteriorPhoto(null)
            setSlipPhoto(null)
            setNotes('')
            setSubmitted(false)
            setTaskId(null)
            setError(null)
          }}
        >
          Neue Retoure
        </button>
        <button
          className="btn btn-secondary btn-full"
          style={{ maxWidth: 320 }}
          onClick={() => router.push('/')}
        >
          Zur Startseite
        </button>
      </div>
    )
  }

  const isNextEnabled = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : step === 3 ? isStep3Valid : true

  const stepLabels = ['PAKET', 'ÖFFNEN', 'ARTIKEL', 'SENDEN']

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface-2)' }}>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* HEADER */}
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 14, padding: '4px 0', flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {step === 1 ? 'Startseite' : 'Zurück'}
        </button>
        <div style={{ width: 1, height: 16, backgroundColor: 'var(--border)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 15, flex: 1, color: 'var(--text)' }}>Retoure erfassen</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {step === 3 && articles.length > 0 ? `3/4 · Art.${currentArticleIdx + 1}/${articles.length}` : `${step}/4`}
        </span>
      </header>

      {/* PROGRESS TRACK */}
      <div style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px 10px' }}>
        {/* Dots and connector lines */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[1, 2, 3, 4].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                ...(i < step - 1
                  ? { backgroundColor: 'var(--green)' }
                  : i === step - 1
                    ? { backgroundColor: 'var(--blue)', boxShadow: '0 0 0 3px var(--blue-bg)' }
                    : { backgroundColor: 'var(--surface-3)', border: '1.5px solid var(--border)' }),
              }}>
                {i < step - 1
                  ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )
                  : (
                    <span style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: i === step - 1 ? 'white' : 'var(--text-muted)',
                    }}>
                      {s}
                    </span>
                  )
                }
              </div>
              {i < 3 && (
                <div style={{ flex: 1, height: 2, backgroundColor: i < step - 1 ? 'var(--green)' : 'var(--border)' }} />
              )}
            </React.Fragment>
          ))}
        </div>
        {/* Step labels */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 6 }}>
          {stepLabels.map((label, i) => (
            <React.Fragment key={label}>
              <div style={{ width: 24, position: 'relative', flexShrink: 0 }}>
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: i === step - 1 ? 'var(--blue)' : i < step - 1 ? 'var(--green)' : 'var(--text-muted)',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                  fontWeight: i === step - 1 ? 600 : 400,
                }}>
                  {label}
                </div>
              </div>
              {i < 3 && <div style={{ flex: 1 }} />}
            </React.Fragment>
          ))}
        </div>
        {/* Spacer for label height */}
        <div style={{ height: 16 }} />
      </div>

      {/* CONTENT */}
      <div className="page-content" style={{ flex: 1, paddingBottom: 100 }}>

        {/* STEP 1: Tracking number */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Paket scannen</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Tracking-Nummer des eingehenden Pakets eingeben oder scannen.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                TRACKING-NUMMER
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
              {trackingNumber.trim().length > 0 && trackingNumber.trim().length <= 3 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  Mindestens 4 Zeichen erforderlich
                </div>
              )}
            </div>

            {trackingNumber.trim().length > 3 && (
              <div style={{
                padding: '14px 16px',
                background: 'var(--blue-bg)',
                border: '1.5px solid var(--blue-border)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="1" />
                  <path d="M16 8h4l3 5v3h-7V8z" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--blue-dark)', letterSpacing: '0.06em', marginBottom: 2 }}>TRACKING</div>
                  <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 500 }}>{trackingNumber.trim()}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Find order */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Bestellung suchen</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Bestellnummer, Kundennummer oder Name eingeben.
              </p>
            </div>

            {selectedOrder ? (
              <div>
                <div style={{
                  padding: '16px 18px',
                  background: 'var(--surface)',
                  border: '2px solid var(--blue)',
                  borderRadius: 14,
                  marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{selectedOrder.customerName}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                        #{selectedOrder.orderNumber}
                        {selectedOrder.customerNumber ? ` · KD ${selectedOrder.customerNumber}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedOrder(null); setSearchQuery('') }}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-3)', padding: '4px 10px' }}
                    >
                      Ändern
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {selectedOrder.items.map(item => (
                      <span key={item.id} style={{
                        fontSize: 12,
                        color: 'var(--text-3)',
                        background: 'var(--surface-3)',
                        border: '1px solid var(--border-2)',
                        borderRadius: 5,
                        padding: '2px 7px',
                      }}>
                        {item.productName}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
                  {selectedOrder.items.length} Artikel · {selectedOrder.date}
                  {searchMode === 'demo' && (
                    <span style={{ marginLeft: 8 }} className="badge badge-gold">Demo</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="input-wrap input-icon-left" style={{ marginBottom: 12 }}>
                  <svg className="input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M14 14l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    className="input"
                    type="search"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Bestellnr., Name, Kundennr. …"
                    autoFocus
                    autoComplete="off"
                  />
                </div>

                {searching && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                    <SearchSpinner />
                    Suche läuft…
                  </div>
                )}

                {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                    Keine Bestellungen gefunden für „{searchQuery}"
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="section-title" style={{ marginBottom: 4 }}>
                      {searchResults.length} Treffer
                      {searchMode === 'demo' && <span className="badge badge-gold" style={{ marginLeft: 8 }}>Demo</span>}
                    </div>
                    {searchResults.map(order => (
                      <button
                        key={order.id}
                        onClick={() => { refreshActivity(); setSelectedOrder(order) }}
                        style={{
                          all: 'unset',
                          display: 'block',
                          cursor: 'pointer',
                          background: 'var(--surface)',
                          border: '1.5px solid var(--border)',
                          borderRadius: 12,
                          padding: '14px 16px',
                          transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--blue)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{order.customerName}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{order.date}</div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                          #{order.orderNumber}
                          {order.customerNumber ? ` · KD ${order.customerNumber}` : ''}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {order.items.slice(0, 2).map(item => (
                            <span key={item.id} style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 4, padding: '1px 6px' }}>
                              {item.productName}
                            </span>
                          ))}
                          {order.items.length > 2 && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '1px 4px' }}>+{order.items.length - 2}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Article capture */}
        {step === 3 && currentArticle && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>
                ARTIKEL {currentArticleIdx + 1} VON {articles.length}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4 }}>
                {currentArticle.productName}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Bestellt: {currentArticle.orderedQty}×
              </div>
            </div>

            {/* Progress dots for articles */}
            {articles.length > 1 && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                {articles.map((a, i) => (
                  <div
                    key={a.itemId}
                    style={{
                      height: 3,
                      flex: 1,
                      borderRadius: 2,
                      backgroundColor: i < currentArticleIdx
                        ? 'var(--green)'
                        : i === currentArticleIdx
                          ? 'var(--blue)'
                          : 'var(--border)',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Returned toggle */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 10 }}>
                WURDE DIESER ARTIKEL RETOURNIERT?
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => updateArticle(currentArticleIdx, { returned: true })}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: 10,
                    border: `2px solid ${currentArticle.returned === true ? 'var(--blue)' : 'var(--border)'}`,
                    background: currentArticle.returned === true ? 'var(--blue-bg)' : 'var(--surface)',
                    color: currentArticle.returned === true ? 'var(--blue)' : 'var(--text-3)',
                    fontWeight: currentArticle.returned === true ? 700 : 400,
                    fontSize: 15,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Ja
                </button>
                <button
                  onClick={() => updateArticle(currentArticleIdx, { returned: false, condition: null, reason: null, photo: null })}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: 10,
                    border: `2px solid ${currentArticle.returned === false ? 'var(--border)' : 'var(--border)'}`,
                    background: currentArticle.returned === false ? 'var(--surface-3)' : 'var(--surface)',
                    color: currentArticle.returned === false ? 'var(--text-2)' : 'var(--text-3)',
                    fontWeight: currentArticle.returned === false ? 700 : 400,
                    fontSize: 15,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Nein
                </button>
              </div>
            </div>

            {/* Condition and reason (only when returned) */}
            {currentArticle.returned === true && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>ZUSTAND</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {CONDITIONS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => updateArticle(currentArticleIdx, { condition: c.value })}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: `1.5px solid ${currentArticle.condition === c.value ? 'var(--blue)' : 'var(--border)'}`,
                          background: currentArticle.condition === c.value ? 'var(--blue-bg)' : 'var(--surface)',
                          color: currentArticle.condition === c.value ? 'var(--blue)' : 'var(--text-3)',
                          fontWeight: currentArticle.condition === c.value ? 600 : 400,
                          fontSize: 14,
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                          textAlign: 'left',
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>RÜCKGABEGRUND</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {REASONS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => updateArticle(currentArticleIdx, { reason: r.value })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: `1.5px solid ${currentArticle.reason === r.value ? 'var(--blue)' : 'var(--border)'}`,
                          background: currentArticle.reason === r.value ? 'var(--blue-bg)' : 'var(--surface)',
                          color: currentArticle.reason === r.value ? 'var(--blue)' : 'var(--text-3)',
                          fontWeight: currentArticle.reason === r.value ? 600 : 400,
                          fontSize: 14,
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                          textAlign: 'left',
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Article photo */}
                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>
                    FOTO (OPTIONAL)
                  </div>
                  {currentArticle.photo ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentArticle.photo.dataUrl}
                        alt="Artikel"
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{currentArticle.photo.name}</div>
                        <button
                          onClick={() => updateArticle(currentArticleIdx, { photo: null })}
                          style={{ background: 'none', border: '1px solid var(--red-border)', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--red)', padding: '4px 10px' }}
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => capturePhoto('article')}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <CameraIcon />
                      Foto aufnehmen
                    </button>
                  )}
                </div>
              </div>
            )}

            {currentArticle.returned === false && (
              <div style={{
                padding: '14px 16px',
                background: 'var(--surface-3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 14,
                color: 'var(--text-muted)',
              }}>
                Dieser Artikel wird nicht als Retoure erfasst.
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Review & photos */}
        {step === 4 && selectedOrder && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Abschließen</h2>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Paket-Fotos und Bemerkungen hinzufügen, dann absenden.
              </p>
            </div>

            {/* Order summary */}
            <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>BESTELLUNG</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{selectedOrder.customerName}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>#{selectedOrder.orderNumber}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {articles.filter(a => a.returned === true).map(a => (
                  <span key={a.itemId} style={{ fontSize: 12, background: 'var(--blue-bg)', border: '1px solid var(--blue-border)', color: 'var(--blue)', borderRadius: 4, padding: '2px 7px' }}>
                    {a.productName}
                  </span>
                ))}
                {articles.filter(a => a.returned !== true).length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 4px' }}>
                    {articles.filter(a => a.returned !== true).length} nicht zurück
                  </span>
                )}
              </div>
            </div>

            {/* Package photos */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 10 }}>
                PAKET-FOTOS (OPTIONAL)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { key: 'label' as const, label: 'Adressetikett', photo: labelPhoto },
                  { key: 'exterior' as const, label: 'Paket außen', photo: exteriorPhoto },
                  { key: 'slip' as const, label: 'Retourenschein', photo: slipPhoto },
                ]).map(({ key, label, photo }) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'var(--surface)',
                      border: `1px solid ${photo ? 'var(--green-border)' : 'var(--border)'}`,
                      borderRadius: 10,
                    }}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.dataUrl} alt={label} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 6, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>
                        <CameraIcon />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginBottom: 2 }}>{label}</div>
                      {photo && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{photo.name}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => capturePhoto(key)}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-3)', padding: '6px 10px' }}
                      >
                        {photo ? 'Neu' : 'Foto'}
                      </button>
                      {photo && (
                        <button
                          onClick={() => {
                            if (key === 'label') setLabelPhoto(null)
                            else if (key === 'exterior') setExteriorPhoto(null)
                            else setSlipPhoto(null)
                          }}
                          style={{ background: 'none', border: '1px solid var(--red-border)', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--red)', padding: '6px 10px' }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                BEMERKUNGEN (OPTIONAL)
              </label>
              <textarea
                value={notes}
                onChange={e => { refreshActivity(); setNotes(e.target.value) }}
                placeholder="z. B. Paket war beschädigt, Inhalt vollständig"
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
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{ border: '1px solid var(--red-border)', background: 'var(--red-bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 14, color: 'var(--red-dark)' }}>
                Fehler: {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex',
        gap: 10,
        zIndex: 10,
      }}>
        <button
          className="btn btn-secondary"
          onClick={handleBack}
          style={{ flex: '0 0 auto', minWidth: 80 }}
        >
          {step === 1 ? 'Abbrechen' : 'Zurück'}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleNext}
          disabled={!isNextEnabled || submitting}
          style={{ flex: 1, opacity: !isNextEnabled ? 0.5 : 1 }}
        >
          {step === 4 ? (
            submitting ? (
              <>
                <ButtonSpinner />
                Wird gesendet…
              </>
            ) : (
              <>
                <AsanaIcon />
                An Asana senden
              </>
            )
          ) : step === 3 ? (
            currentArticleIdx < articles.length - 1
              ? `Nächster Artikel (${currentArticleIdx + 2}/${articles.length})`
              : 'Weiter zur Übersicht'
          ) : (
            'Weiter'
          )}
        </button>
      </div>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5.5 2L4 4H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2L10.5 2h-5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <circle cx="8" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function SearchSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="9" cy="9" r="7" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ButtonSpinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function AsanaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="6" r="3" fill="white" opacity="0.9" />
      <circle cx="4" cy="12" r="3" fill="white" opacity="0.7" />
      <circle cx="14" cy="12" r="3" fill="white" opacity="0.7" />
    </svg>
  )
}
