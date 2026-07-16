'use client'

import { SearchSpinner, CameraIcon } from '@/components/retouren-wizard/icons'
import type { Order } from '@/lib/types'

type Photo = { id: string; dataUrl: string; name: string; type: string }

interface Step2SearchOrderProps {
  slipPhotos: Photo[]
  searchQuery: string
  setSearchQuery: (value: string) => void
  searchResults: Order[]
  searching: boolean
  selectedOrder: Order | null
  setSelectedOrder: (order: Order | null) => void
  onCapturePhoto: () => void
  onRemovePhoto: (photoId: string) => void
  onSearchChange: (query: string) => void
  refreshActivity: () => void
}

export function Step2SearchOrder({
  slipPhotos,
  searchQuery,
  setSearchQuery,
  searchResults,
  searching,
  selectedOrder,
  setSelectedOrder,
  onCapturePhoto,
  onRemovePhoto,
  onSearchChange,
  refreshActivity,
}: Step2SearchOrderProps) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Paket öffnen</h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>Retourenschein fotografieren und Bestellung suchen.</p>
      </div>

      {/* Slip photos */}
      <div onClick={onCapturePhoto} style={{ border: `1.5px ${slipPhotos.length > 0 ? 'solid var(--green-border)' : 'dashed var(--border)'}`, borderRadius: 12, background: slipPhotos.length > 0 ? 'var(--green-bg)' : 'var(--surface)', padding: '14px 16px', cursor: 'pointer', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {slipPhotos.length === 0 && (
            <div style={{ width: 52, height: 52, borderRadius: 8, border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}><CameraIcon size={22} /></div>
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginBottom: 2 }}>
              {slipPhotos.length > 1 ? 'Retourenscheine' : 'Retourenschein'}
            </div>
            <div style={{ fontSize: 12, color: slipPhotos.length > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
              {slipPhotos.length > 0
                ? `✓ ${slipPhotos.length} ${slipPhotos.length === 1 ? 'Foto' : 'Fotos'} · Weiteres hinzufügen +`
                : 'Lieferschein oder Retourenzettel fotografieren'}
            </div>
          </div>
        </div>
        {slipPhotos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {slipPhotos.map((photo) => (
              <div key={photo.id} style={{ position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.dataUrl} alt="Retourenschein" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                <button
                  onClick={(e) => { e.stopPropagation(); onRemovePhoto(photo.id) }}
                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'var(--red)', color: '#fff', fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order search */}
      {selectedOrder ? (
        <div>
          <div style={{ padding: '16px 18px', background: 'var(--surface)', border: '2px solid var(--blue)', borderRadius: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedOrder.customerName}
                  {(selectedOrder.source === 'ATLOS' || selectedOrder.source === 'TSHOS') && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border-2)', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>
                      {selectedOrder.source === 'TSHOS' ? 'TS' : 'AT'}
                    </span>
                  )}
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
            {selectedOrder.notInvoiced && <span className="badge badge-gold" style={{ marginLeft: 8 }}>noch nicht fakturiert</span>}
          </div>
          {selectedOrder.notInvoiced && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6, lineHeight: 1.4 }}>
              Zu dieser Bestellung liegt noch keine Rechnung vor – Artikel aus den Bestellpositionen. Preise können noch abweichen.
            </div>
          )}
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
            <input className="input" type="search" value={searchQuery} onChange={e => onSearchChange(e.target.value)} placeholder="Bestellnr., Name, Kundennr. …" autoFocus autoComplete="off" />
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
                      {(order.source === 'ATLOS' || order.source === 'TSHOS') && (
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border-2)', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>
                          {order.source === 'TSHOS' ? 'TS' : 'AT'}
                        </span>
                      )}
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
                    {order.notInvoiced && <span className="badge badge-gold" style={{ marginLeft: 8 }}>nicht fakturiert</span>}
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
  )
}
