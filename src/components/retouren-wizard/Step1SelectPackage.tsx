'use client'

import { CameraIcon } from '@/components/retouren-wizard/icons'

type Photo = { id: string; dataUrl: string; name: string; type: string }

interface Step1SelectPackageProps {
  trackingNumber: string
  setTrackingNumber: (value: string) => void
  isDhlReturn: boolean | null
  setIsDhlReturn: (value: boolean | null) => void
  labelPhoto: Photo | null
  exteriorPhoto: Photo | null
  onCapturePhoto: (key: 'label' | 'exterior') => void
  refreshActivity: () => void
}

export function Step1SelectPackage({
  trackingNumber,
  setTrackingNumber,
  isDhlReturn,
  setIsDhlReturn,
  labelPhoto,
  exteriorPhoto,
  onCapturePhoto,
  refreshActivity,
}: Step1SelectPackageProps) {
  return (
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
          <div key={key} onClick={() => onCapturePhoto(key)} style={{ border: `1.5px ${photo ? 'solid var(--green-border)' : 'dashed var(--border)'}`, borderRadius: 12, background: photo ? 'var(--green-bg)' : 'var(--surface)', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 110, justifyContent: 'center' }}>
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
  )
}
