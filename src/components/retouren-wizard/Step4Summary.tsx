'use client'

import type { Order } from '@/lib/types'
import type { ArticleCapture } from '@/components/retouren-wizard/ArticleRow'
import { formatRelativeDays } from '@/lib/format'

type Photo = { id: string; dataUrl: string; name: string; type: string }

const CONDITIONS: { value: string; label: string }[] = [
  { value: 'gut', label: 'Gut' },
  { value: 'beschaedigt', label: 'Beschädigt' },
  { value: 'unvollstaendig', label: 'Unvollständig' },
  { value: 'defekt', label: 'Defekt' },
]

const REASONS: { value: string; label: string }[] = [
  { value: 'gefaellt_nicht', label: 'Gefällt nicht' },
  { value: 'falsch_geliefert', label: 'Falsch geliefert' },
  { value: 'defekt_bei_ankunft', label: 'Defekt bei Ankunft' },
  { value: 'groesse_passt_nicht', label: 'Größe passt nicht' },
  { value: 'beschaedigt_bei_lieferung', label: 'Beschädigt bei Lieferung' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

interface Step4SummaryProps {
  selectedOrder: Order
  trackingNumber: string
  articles: ArticleCapture[]
  notes: string
  setNotes: (value: string) => void
  isDhlReturn: boolean | null
  labelPhotos: Photo[]
  exteriorPhotos: Photo[]
  slipPhotos: Photo[]
  operator: string | null
  error: string | null
  refreshActivity: () => void
}

export function Step4Summary({
  selectedOrder,
  trackingNumber,
  articles,
  notes,
  setNotes,
  isDhlReturn,
  labelPhotos,
  exteriorPhotos,
  slipPhotos,
  operator,
  error,
  refreshActivity,
}: Step4SummaryProps) {
  return (
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
          { label: 'FOTOS', val: `${labelPhotos.length + exteriorPhotos.length + slipPhotos.length + articles.reduce((sum, a) => sum + a.photos.length, 0)} Aufnahmen` },
          { label: 'MITARBEITER', val: operator },
        ] as { label: string; val: React.ReactNode }[]).map(({ label, val }, i, arr) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: i < arr.length - 1 ? 10 : 0, marginBottom: i < arr.length - 1 ? 10 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right' as const, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Rechnungsdatum-Hinweis */}
      {selectedOrder.invoiceDate && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: selectedOrder.invoiceDateWarning ? '#fff7ed' : 'var(--surface)',
          border: `1px solid ${selectedOrder.invoiceDateWarning ? '#fed7aa' : 'var(--border)'}`,
        }}>
          {selectedOrder.invoiceDateWarning && (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
              <path d="M9 2L1.5 15.5h15L9 2z" stroke="#ea580c" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 7v4" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="9" cy="13" r="0.75" fill="#ea580c"/>
            </svg>
          )}
          <span style={{ fontSize: 13, color: selectedOrder.invoiceDateWarning ? '#9a3412' : 'var(--text-3)' }}>
            Rechnung vom <strong>{selectedOrder.invoiceDate}</strong>
            {selectedOrder.invoiceDateDays != null && <> ({formatRelativeDays(selectedOrder.invoiceDateDays)})</>}
            {selectedOrder.invoiceDateWarning && ' — älter als 14 Tage! Wird auch in Asana vermerkt.'}
          </span>
        </div>
      )}

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
  )
}
