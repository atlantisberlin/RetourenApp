'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { compressImageToDataUrl } from '@/lib/compress-image'

type PhotoType = 'etikett' | 'schein' | 'paket' | 'artikel'
type Photo = { id: string; type: PhotoType; dataUrl: string; name: string }

const PHOTO_SLOTS: { type: PhotoType; label: string; hint: string }[] = [
  { type: 'etikett', label: 'Adressetikett', hint: 'Absender & Empfänger' },
  { type: 'schein', label: 'Retourenschein', hint: 'falls vorhanden' },
  { type: 'paket', label: 'Paket / Verpackung', hint: 'Zustand außen' },
  { type: 'artikel', label: 'Artikel', hint: 'Inhalt & Zustand' },
]

export default function FotosScreen({ orderId }: { orderId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeSlot, setActiveSlot] = useState<PhotoType | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (!files.length || !activeSlot) return
      setUploading(true)
      const newPhotos: Photo[] = await Promise.all(
        files.map(async (file) => ({
          id: `${Date.now()}-${Math.random()}`,
          type: activeSlot,
          // komprimiert, damit localStorage und Upload klein bleiben
          dataUrl: await compressImageToDataUrl(file),
          name: file.name,
        }))
      )
      setPhotos((prev) => [...prev, ...newPhotos])
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    },
    [activeSlot]
  )

  function openPicker(type: PhotoType) {
    setActiveSlot(type)
    setTimeout(() => fileRef.current?.click(), 50)
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  function handleContinue() {
    const existing = JSON.parse(localStorage.getItem('return_capture') ?? '{}')
    localStorage.setItem(
      'return_capture',
      JSON.stringify({ ...existing, photos })
    )
    router.push(`/order/${orderId}/zusammenfassung`)
  }

  return (
    <>
      <header className="page-header">
        <Link
          href={`/order/${orderId}/erfassen`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', padding: '8px 4px' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 14 }}>Positionen</span>
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Fotos</span>
      </header>

      {/* Step indicator */}
      <StepIndicator current={1} />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="page-content">
        <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.5 }}>
          Fotos direkt mit der Kamera aufnehmen oder aus der Galerie wählen. Alle Felder sind optional.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {PHOTO_SLOTS.map((slot) => {
            const slotPhotos = photos.filter((p) => p.type === slot.type)
            return (
              <div
                key={slot.type}
                className="card"
                style={{ padding: '16px 18px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: slotPhotos.length > 0 ? 12 : 0 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{slot.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{slot.hint}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '9px 14px', fontSize: 13 }}
                    onClick={() => openPicker(slot.type)}
                  >
                    <CameraIcon />
                    {slotPhotos.length > 0 ? 'Weiteres' : 'Foto'}
                  </button>
                </div>

                {slotPhotos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {slotPhotos.map((photo) => (
                      <div key={photo.id} style={{ position: 'relative' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.dataUrl}
                          alt={slot.label}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: 'cover',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            border: 'none',
                            background: 'var(--red)',
                            color: '#fff',
                            fontSize: 14,
                            lineHeight: 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {uploading && activeSlot === slot.type && (
                      <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: 10,
                        border: '1.5px dashed var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}>
                        …
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {photos.length > 0 && (
          <div style={{ marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
            {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'} aufgenommen
          </div>
        )}

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleContinue}
          style={{ marginBottom: 12 }}
        >
          Weiter zur Zusammenfassung →
        </button>
        <button
          className="btn btn-secondary btn-full"
          onClick={handleContinue}
        >
          Ohne Fotos fortfahren
        </button>
      </div>
    </>
  )
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5.5 2L4 4H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2L10.5 2h-5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <circle cx="8" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function StepIndicator({ current }: { current: number }) {
  const steps = ['Positionen', 'Fotos', 'Senden']
  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', gap: 6 }}>
      {steps.map((step, i) => (
        <div
          key={step}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: i === current ? 'var(--purple)' : i < current ? 'var(--text-muted)' : 'var(--text-faint)',
            fontWeight: i === current ? 600 : 400,
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
              background: i < current ? 'var(--green-bg)' : i === current ? 'var(--purple)' : 'var(--surface-3)',
              color: i < current ? 'var(--green)' : i === current ? '#fff' : 'var(--text-faint)',
              border: i < current ? '1px solid var(--green-border)' : 'none',
            }}
          >
            {i < current ? '✓' : i + 1}
          </div>
          {step}
          {i < 2 && <span style={{ color: 'var(--border)', marginLeft: 2 }}>›</span>}
        </div>
      ))}
    </div>
  )
}
