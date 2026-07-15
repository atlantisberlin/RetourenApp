'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { refreshActivity } from '@/lib/operator'
import { apiPost } from '@/lib/api-client'
import type { ApiResponse } from '@/lib/api-response'
import { compressImageToDataUrl } from '@/lib/compress-image'
import { uploadPhotosToTask, type UploadablePhoto } from '@/lib/photo-upload'

type Photo = { id: string; dataUrl: string; name: string; type: string }

const CARRIER_OPTIONS = ['DHL', 'UPS', 'DPD', 'GLS', 'FedEx', 'Hermes']

export default function VersandScreen() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [insuranceValue, setInsuranceValue] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null)
  const [photoWarning, setPhotoWarning] = useState<string | null>(null)
  const [failedPhotos, setFailedPhotos] = useState<UploadablePhoto[]>([])
  const [retryingPhotos, setRetryingPhotos] = useState(false)

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    // komprimiert, damit einzelne Uploads klein bleiben (kein 413)
    const newPhotos: Photo[] = await Promise.all(
      files.map(async (file) => ({
        id: `${Date.now()}-${Math.random()}`,
        type: 'versand',
        dataUrl: await compressImageToDataUrl(file),
        name: file.name,
      }))
    )
    setPhotos((prev) => [...prev, ...newPhotos])
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  async function handleSubmit() {
    if (!trackingNumber.trim()) return
    refreshActivity()
    setSubmitting(true)
    setError(null)
    try {
      // Fotos werden NICHT mitgesendet (413 Payload Too Large), sondern
      // nach dem Anlegen der Aufgabe einzeln über /api/attach-photo hochgeladen
      const response = await apiPost<{ taskId: string }>('/api/versand', {
        carrier,
        trackingNumber: trackingNumber.trim(),
        deliveryNote: deliveryNote.trim(),
        insuranceValue: insuranceValue.trim(),
        notes: notes.trim(),
      })
      const resp = response as ApiResponse<{ taskId: string }>
      if (!resp.success) {
        throw new Error(resp.error || 'Submission failed')
      }
      const data = resp.data

      if (photos.length > 0 && data.taskId) {
        setPhotoProgress({ done: 0, total: photos.length })
        const uploadResult = await uploadPhotosToTask(data.taskId, photos, (done, total) => {
          setPhotoProgress({ done, total })
        })
        setPhotoProgress(null)
        if (uploadResult.failed > 0) {
          console.error('Versand-Foto-Upload-Fehler:', uploadResult.errors)
          setPhotoWarning(`${uploadResult.uploaded} von ${photos.length} Fotos hochgeladen. Fehlgeschlagen: ${uploadResult.errors.join('; ')}`)
          setFailedPhotos(uploadResult.failedPhotos)
        }
      }

      setTaskId(data.taskId)
      setSubmitted(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetryPhotos() {
    if (!taskId || failedPhotos.length === 0 || retryingPhotos) return
    setRetryingPhotos(true)
    setPhotoProgress({ done: 0, total: failedPhotos.length })
    const uploadResult = await uploadPhotosToTask(taskId, failedPhotos, (done, total) => {
      setPhotoProgress({ done, total })
    })
    setPhotoProgress(null)
    setFailedPhotos(uploadResult.failedPhotos)
    if (uploadResult.failed > 0) {
      console.error('Versand-Foto-Upload erneut fehlgeschlagen:', uploadResult.errors)
      setPhotoWarning(`${uploadResult.uploaded} von ${failedPhotos.length} Fotos hochgeladen. Fehlgeschlagen: ${uploadResult.errors.join('; ')}`)
    } else {
      setPhotoWarning(null)
    }
    setRetryingPhotos(false)
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="page-header">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Atlantis</span>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Versand</span>
        </header>
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--purple-bg)', border: '2px solid var(--purple-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M8 16l5.5 5.5L24 10" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Sendung dokumentiert</h2>
          <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5, maxWidth: '28ch' }}>
            Die Asana-Aufgabe wurde im Projekt „Versand" angelegt.
          </p>
          {photoWarning && (
            <div style={{ fontSize: 13, color: 'var(--gold-dark)', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, maxWidth: 360 }}>
              ⚠️ {photoWarning}
            </div>
          )}
          {failedPhotos.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ maxWidth: 320, marginBottom: 24 }}
              onClick={handleRetryPhotos}
              disabled={retryingPhotos}
            >
              {retryingPhotos
                ? (photoProgress ? `Foto ${photoProgress.done}/${photoProgress.total} wird hochgeladen…` : 'Wird versucht…')
                : `${failedPhotos.length} ${failedPhotos.length === 1 ? 'Foto' : 'Fotos'} erneut hochladen`
              }
            </button>
          )}
          {taskId && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
              Task-ID: {taskId}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
            <button className="btn btn-primary btn-lg btn-full" onClick={() => { setSubmitted(false); setCarrier(''); setTrackingNumber(''); setDeliveryNote(''); setInsuranceValue(''); setNotes(''); setPhotos([]); setPhotoWarning(null); setFailedPhotos([]) }}>
              Neue Sendung dokumentieren
            </button>
            <button className="btn btn-secondary btn-full" style={{ display: 'flex' }} onClick={() => router.push('/')}>
              Zur Startseite
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="page-header">
        <button
          onClick={() => router.push('/')}
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', padding: '8px 4px' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 14 }}>Startseite</span>
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Versand dokumentieren</span>
      </header>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={handleFileChange} />

      <div className="page-content">
        <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.5 }}>
          Sendung vor dem Versand erfassen — Fotos als Nachweis für Reklamationen.
        </p>

        {/* Carrier */}
        <div className="section-title" style={{ marginBottom: 10 }}>Logistikunternehmen</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {CARRIER_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCarrier(c === carrier ? '' : c)}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                border: `1.5px solid ${carrier === c ? 'var(--purple)' : 'var(--border)'}`,
                background: carrier === c ? 'var(--purple-bg)' : 'var(--surface)',
                color: carrier === c ? 'var(--purple)' : 'var(--text-2)',
                transition: 'all 0.12s',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Tracking + Lieferschein */}
        <div className="card-section" style={{ marginBottom: 20 }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-2)' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              TRACKINGNUMMER <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              className="input"
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="z. B. 1Z999AA10123456784"
              autoComplete="off"
            />
          </div>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-2)' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              LIEFERSCHEINNUMMER (optional)
            </label>
            <input
              className="input"
              type="text"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="z. B. LS-100421"
              autoComplete="off"
            />
          </div>
          <div style={{ padding: '16px 18px' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              VERSICHERUNGSSUMME in Euro (optional)
            </label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={insuranceValue}
              onChange={(e) => setInsuranceValue(e.target.value)}
              placeholder="z. B. 250.00"
            />
          </div>
        </div>

        {/* Photos */}
        <div className="section-title" style={{ marginBottom: 10 }}>Fotos Versandlabel & Inhalt</div>
        <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: photos.length > 0 ? 14 : 0 }}>
            <div style={{ fontSize: 14, color: 'var(--text-3)' }}>
              {photos.length === 0 ? 'Noch keine Fotos' : `${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'}`}
            </div>
            <button type="button" className="btn btn-secondary" style={{ padding: '9px 14px', fontSize: 13 }} onClick={() => fileRef.current?.click()}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M5.5 2L4 4H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2L10.5 2h-5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                <circle cx="8" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
              </svg>
              Foto aufnehmen
            </button>
          </div>
          {photos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {photos.map((photo) => (
                <div key={photo.id} style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.dataUrl} alt="Versandlabel" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'var(--red)', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card-section" style={{ marginBottom: 28 }}>
          <div style={{ padding: '16px 18px' }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              BEMERKUNGEN (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. Zerbrechlich, Expressversand ins Ausland"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--text)', background: 'var(--surface)', resize: 'vertical', outline: 'none' }}
            />
          </div>
        </div>

        {!trackingNumber.trim() && (
          <div style={{ border: '1px solid var(--gold-border)', background: 'var(--gold-bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: 'var(--gold-dark)' }}>
            Bitte Trackingnummer eingeben.
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
          disabled={submitting || !trackingNumber.trim()}
          style={{ marginBottom: 12, opacity: submitting || !trackingNumber.trim() ? 0.6 : 1, background: 'var(--purple)', borderColor: 'var(--purple)' }}
        >
          {submitting ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
              <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="6" r="3" fill="white" opacity="0.9"/>
              <circle cx="4" cy="12" r="3" fill="white" opacity="0.7"/>
              <circle cx="14" cy="12" r="3" fill="white" opacity="0.7"/>
            </svg>
          )}
          {submitting
            ? photoProgress ? `Foto ${photoProgress.done}/${photoProgress.total} wird hochgeladen…` : 'Wird gesendet…'
            : 'An Asana senden'}
        </button>
        <button className="btn btn-secondary btn-full" style={{ display: 'flex' }} onClick={() => router.push('/')}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
