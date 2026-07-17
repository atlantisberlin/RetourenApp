'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getOperator, refreshActivity } from '@/lib/operator'
import { addToHistory } from '@/lib/history'
import { apiPost, apiGet } from '@/lib/api-client'
import type { ApiResponse } from '@/lib/api-response'
import { compressImageToDataUrl } from '@/lib/compress-image'
import { uploadPhotosToTask, type UploadablePhoto } from '@/lib/photo-upload'
import type { Order, OrderItem, ReturnCapture, ReturnCondition, ReturnReason, ReturnResolution, ReplacementProduct } from '@/lib/types'
import UserSelectionScreen from '@/components/UserSelectionScreen'
import { type ArticleCapture } from '@/components/retouren-wizard/ArticleRow'
import { Step1SelectPackage } from '@/components/retouren-wizard/Step1SelectPackage'
import { Step2SearchOrder } from '@/components/retouren-wizard/Step2SearchOrder'
import { Step3SelectArticles } from '@/components/retouren-wizard/Step3SelectArticles'
import { Step4Summary } from '@/components/retouren-wizard/Step4Summary'
import { ButtonSpinner, AsanaIcon } from '@/components/retouren-wizard/icons'

type Photo = { id: string; dataUrl: string; name: string; type: string }

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
  const [labelPhotos, setLabelPhotos] = useState<Photo[]>([])
  const [exteriorPhotos, setExteriorPhotos] = useState<Photo[]>([])

  // Step 2
  const [slipPhotos, setSlipPhotos] = useState<Photo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Order[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Step 3
  const [articles, setArticles] = useState<ArticleCapture[]>([])

  // Step 4
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null)
  const [photoWarning, setPhotoWarning] = useState<string | null>(null)
  const [failedPhotos, setFailedPhotos] = useState<UploadablePhoto[]>([])
  const [retryingPhotos, setRetryingPhotos] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const photoTargetRef = useRef<'label' | 'exterior' | 'slip' | number>('label')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingArticlesRef = useRef<Array<Omit<ArticleCapture, 'photos'>> | null>(null)

  // Ausstehende Debounce-Suche abbrechen, wenn die Komponente verlassen wird
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

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
      photos: [] as Photo[],
      existingRetoure: item.existingRetoure ?? null,
      existingGutschrift: item.existingGutschrift ?? null,
      reklamation: false,
    }))
    if (pendingArticlesRef.current) {
      const saved = pendingArticlesRef.current
      pendingArticlesRef.current = null
      setArticles(rebuilt.map(a => {
        const s = saved.find(x => x.itemId === a.itemId)
        return s ? { ...a, returned: s.returned, condition: s.condition, reason: s.reason, reklamation: s.reklamation ?? false } : a
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
        articles: articles.map(({ photos, ...rest }) => rest),
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''
    // Komprimieren, damit einzelne Uploads klein bleiben (kein 413 mehr)
    const newPhotos: Photo[] = await Promise.all(
      files.map(async (file) => ({
        id: `${Date.now()}-${Math.random()}`,
        dataUrl: await compressImageToDataUrl(file),
        name: file.name,
        type: file.type,
      }))
    )
    const t = photoTargetRef.current
    if (t === 'label') setLabelPhotos(prev => [...prev, ...newPhotos])
    else if (t === 'exterior') setExteriorPhotos(prev => [...prev, ...newPhotos])
    else if (t === 'slip') setSlipPhotos(prev => [...prev, ...newPhotos])
    else if (typeof t === 'number') setArticles(prev => prev.map((a, i) => i === t ? { ...a, photos: [...a.photos, ...newPhotos] } : a))
  }

  const removePhoto = (target: 'label' | 'exterior' | 'slip' | number, id: string) => {
    refreshActivity()
    if (target === 'label') setLabelPhotos(prev => prev.filter(p => p.id !== id))
    else if (target === 'exterior') setExteriorPhotos(prev => prev.filter(p => p.id !== id))
    else if (target === 'slip') setSlipPhotos(prev => prev.filter(p => p.id !== id))
    else setArticles(prev => prev.map((a, i) => i === target ? { ...a, photos: a.photos.filter(p => p.id !== id) } : a))
  }

  const handleSearchChange = (q: string) => {
    refreshActivity()
    setSearchQuery(q)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await apiGet<{ orders?: Order[] }>('/api/search?q=' + encodeURIComponent(q))
        setSearchResults(data.orders ?? [])
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
      // Fotos werden NICHT mitgesendet (413 Payload Too Large), sondern
      // nach dem Anlegen der Aufgabe einzeln über /api/attach-photo hochgeladen
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
          reklamation: a.reklamation === true,
        })),
        trackingNumber: trackingNumber.trim(),
        packageService: '',
        notes: notes.trim(),
        operatorName: operator ?? 'Unbekannt',
        dhlReturn: isDhlReturn === true,
      }
      const response = await apiPost<{ taskId: string; reklamationPdf?: string }>('/api/submit', body)
      const resp = response as ApiResponse<{ taskId: string; reklamationPdf?: string }>
      if (!resp.success) {
        throw new Error(resp.error || 'Submission failed')
      }
      const data = resp.data

      // Reklamationsschein zum sofortigen Ausdrucken in neuem Tab öffnen
      if (data.reklamationPdf) {
        try {
          const byteChars = atob(data.reklamationPdf)
          const byteNumbers = new Array(byteChars.length)
          for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
          const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
          window.open(URL.createObjectURL(blob), '_blank')
        } catch (err) {
          console.error('Reklamations-PDF konnte nicht geöffnet werden:', err)
        }
      }

      // Fotos einzeln zur angelegten Asana-Aufgabe hochladen
      const photos = [
        ...labelPhotos.map(p => ({ dataUrl: p.dataUrl, type: 'etikett' })),
        ...exteriorPhotos.map(p => ({ dataUrl: p.dataUrl, type: 'paket' })),
        ...slipPhotos.map(p => ({ dataUrl: p.dataUrl, type: 'schein' })),
        ...articles.flatMap(a => a.photos.map(p => ({ dataUrl: p.dataUrl, type: 'artikel' }))),
      ]

      if (photos.length > 0 && data.taskId) {
        setPhotoProgress({ done: 0, total: photos.length })
        const uploadResult = await uploadPhotosToTask(data.taskId, photos, (done, total) => {
          setPhotoProgress({ done, total })
        })
        setPhotoProgress(null)
        if (uploadResult.failed > 0) {
          console.error('Foto-Upload-Fehler:', uploadResult.errors)
          setPhotoWarning(`${uploadResult.uploaded} von ${photos.length} Fotos hochgeladen. Fehlgeschlagen: ${uploadResult.errors.join('; ')}`)
          setFailedPhotos(uploadResult.failedPhotos)
        }
      }

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
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    }
    setSubmitting(false)
  }

  const handleRetryPhotos = async () => {
    if (!taskId || failedPhotos.length === 0 || retryingPhotos) return
    setRetryingPhotos(true)
    setPhotoProgress({ done: 0, total: failedPhotos.length })
    const uploadResult = await uploadPhotosToTask(taskId, failedPhotos, (done, total) => {
      setPhotoProgress({ done, total })
    })
    setPhotoProgress(null)
    setFailedPhotos(uploadResult.failedPhotos)
    if (uploadResult.failed > 0) {
      console.error('Foto-Upload erneut fehlgeschlagen:', uploadResult.errors)
      setPhotoWarning(`${uploadResult.uploaded} von ${failedPhotos.length} Fotos hochgeladen. Fehlgeschlagen: ${uploadResult.errors.join('; ')}`)
    } else {
      setPhotoWarning(null)
    }
    setRetryingPhotos(false)
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
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 32, textAlign: 'center' }}>
          Die Retoure wurde erfolgreich erfasst und an Asana übermittelt.
        </p>
        {photoWarning && (
          <div style={{ fontSize: 13, color: 'var(--gold-dark)', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, maxWidth: 360, textAlign: 'center' }}>
            ⚠️ {photoWarning}
          </div>
        )}
        {failedPhotos.length > 0 && (
          <button
            className="btn btn-secondary"
            style={{ maxWidth: 320, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={handleRetryPhotos}
            disabled={retryingPhotos}
          >
            {retryingPhotos
              ? <><ButtonSpinner /> {photoProgress ? `Foto ${photoProgress.done}/${photoProgress.total} wird hochgeladen…` : 'Wird versucht…'}</>
              : `${failedPhotos.length} ${failedPhotos.length === 1 ? 'Foto' : 'Fotos'} erneut hochladen`
            }
          </button>
        )}
        {taskId && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 32 }}>Task-ID: {taskId}</div>
        )}
        <button className="btn btn-primary btn-lg btn-full" style={{ maxWidth: 320, marginBottom: 12 }} onClick={() => {
          localStorage.removeItem(DRAFT_KEY)
          setStep(1); setTrackingNumber(''); setIsDhlReturn(null); setLabelPhotos([]); setExteriorPhotos([]); setSlipPhotos([])
          setSearchQuery(''); setSearchResults([]); setSelectedOrder(null); setArticles([])
          setNotes(''); setSubmitted(false); setTaskId(null); setError(null); setPhotoWarning(null); setFailedPhotos([])
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
      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handleFileChange} />

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
          <Step1SelectPackage
            trackingNumber={trackingNumber}
            setTrackingNumber={setTrackingNumber}
            isDhlReturn={isDhlReturn}
            setIsDhlReturn={setIsDhlReturn}
            labelPhotos={labelPhotos}
            exteriorPhotos={exteriorPhotos}
            onCapturePhoto={(key) => capturePhoto(key)}
            onRemovePhoto={removePhoto}
            refreshActivity={refreshActivity}
          />
        )}

        {/* ── STEP 2: Slip Photo + Order Search ── */}
        {step === 2 && (
          <Step2SearchOrder
            slipPhotos={slipPhotos}
            onRemovePhoto={(id) => removePhoto('slip', id)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            searching={searching}
            selectedOrder={selectedOrder}
            setSelectedOrder={setSelectedOrder}
            onCapturePhoto={() => capturePhoto('slip')}
            onSearchChange={handleSearchChange}
            refreshActivity={refreshActivity}
          />
        )}

        {/* ── STEP 3: Article list ── */}
        {step === 3 && (
          <Step3SelectArticles
            articles={articles}
            onUpdateArticle={updateArticle}
            onCapturePhoto={capturePhoto}
            onRemovePhoto={removePhoto}
          />
        )}

        {/* ── STEP 4: Summary + Notes + Submit ── */}
        {step === 4 && selectedOrder && (
          <Step4Summary
            selectedOrder={selectedOrder}
            trackingNumber={trackingNumber}
            articles={articles}
            notes={notes}
            setNotes={setNotes}
            isDhlReturn={isDhlReturn}
            labelPhotos={labelPhotos}
            exteriorPhotos={exteriorPhotos}
            slipPhotos={slipPhotos}
            operator={operator}
            error={error}
            refreshActivity={refreshActivity}
          />
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', gap: 10, zIndex: 10 }}>
        <button className="btn btn-secondary" onClick={handleBack} style={{ flex: '0 0 auto', minWidth: 80 }}>
          {step === 1 ? 'Abbrechen' : 'Zurück'}
        </button>
        <button className="btn btn-primary" onClick={handleNext} disabled={!isNextEnabled || submitting} style={{ flex: 1, opacity: !isNextEnabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {step === 4
            ? submitting
              ? <><ButtonSpinner /> {photoProgress ? `Foto ${photoProgress.done}/${photoProgress.total} wird hochgeladen…` : 'Wird gesendet…'}</>
              : <><AsanaIcon /> An Asana senden</>
            : 'Weiter'
          }
        </button>
      </div>
    </div>
  )
}
