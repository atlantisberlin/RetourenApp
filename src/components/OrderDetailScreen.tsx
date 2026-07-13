'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Order } from '@/lib/types'
import { getCustomerHistory } from '@/lib/history'
import { formatRelativeDays } from '@/lib/format'

const STATUS_LABELS: Record<string, string> = {
  '1': 'Ausstehend',
  '2': 'In Bearbeitung',
  '3': 'Versendet',
  '4': 'Geliefert',
  '5': 'Storniert',
}

export default function OrderDetailScreen({
  order,
  mode,
}: {
  order: Order
  mode: 'live' | 'demo'
}) {
  const [customerHistory] = useState(() => getCustomerHistory(order.customerNumber))
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
      <header className="page-header">
        <Link
          href="/retouren"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-3)',
            padding: '8px 4px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 14 }}>Suche</span>
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-3)' }}>
          #{order.orderNumber}
        </span>
        {mode === 'demo' && (
          <span className="badge badge-gold" style={{ marginLeft: 'auto' }}>Demo</span>
        )}
      </header>

      <div className="page-content">
        {/* Customer + Order card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                {order.customerName}
                {order.partnershop === 'amazon' && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: '#ff9900', color: '#111', borderRadius: 4, padding: '2px 7px', verticalAlign: 'middle', letterSpacing: '0.04em' }}>
                    Amazon
                  </span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                KD {order.customerNumber}
                {order.customerEmail ? ` · ${order.customerEmail}` : ''}
              </div>
              {order.externOrderId && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Ext: {order.externOrderId}
                </div>
              )}
            </div>
            <span className={`badge ${order.status === '5' ? 'badge-red' : 'badge-blue'}`}>
              {STATUS_LABELS[order.status] ?? `Status ${order.status}`}
            </span>
          </div>

          <hr style={{ marginBottom: 14 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            <MetaRow label="Bestellnr." value={order.orderNumber} mono />
            <MetaRow label="Datum" value={order.date} />
            {order.invoiceNumber && <MetaRow label="Rechnungsnr." value={order.invoiceNumber} mono />}
            {order.invoiceDate && (
              <MetaRow
                label="Rechnungsdatum"
                value={`${order.invoiceDate}${order.invoiceDateDays != null ? ` · ${formatRelativeDays(order.invoiceDateDays)}` : ''}`}
              />
            )}
            {order.deliveryNoteNumber && <MetaRow label="Lieferscheinnr." value={order.deliveryNoteNumber} mono />}
            <MetaRow label="Herkunft" value={order.source ?? 'Zentrallager'} />
          </div>
        </div>

        {customerHistory.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 10, width: '100%' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {customerHistory.length} frühere {customerHistory.length === 1 ? 'Retoure' : 'Retouren'} · letzte am {new Date(customerHistory[0].submittedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{historyOpen ? '▲' : '▼'}</span>
            </button>
            {historyOpen && (
              <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                {customerHistory.slice(0, 3).map((entry, i) => (
                  <div key={entry.id} style={{ padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border-2)' : undefined, background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{new Date(entry.submittedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{entry.operatorName} · {entry.itemCount} Pos.</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {entry.items.map((item, j) => (
                        <span key={j} style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-3)', border: '1px solid var(--border-2)', borderRadius: 4, padding: '2px 6px' }}>{item.productName}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invoice date warning */}
        {order.invoiceDateWarning && order.invoiceDate && (
          <div style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
              <path d="M9 2L1.5 15.5h15L9 2z" stroke="#ea580c" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 7v4" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="9" cy="13" r="0.75" fill="#ea580c"/>
            </svg>
            <span style={{ fontSize: 13, color: '#9a3412' }}>
              Diese Rechnung ist vom <strong>{order.invoiceDate}</strong>
              {order.invoiceDateDays != null && <> ({formatRelativeDays(order.invoiceDateDays)})</>} — älter als 14 Tage!
            </span>
          </div>
        )}

        {/* Not-yet-invoiced notice */}
        {order.notInvoiced && (
          <div style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
              <path d="M9 2L1.5 15.5h15L9 2z" stroke="#ea580c" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 7v4" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="9" cy="13" r="0.75" fill="#ea580c"/>
            </svg>
            <span style={{ fontSize: 13, color: '#9a3412' }}>
              Zu dieser Bestellung liegt noch keine Rechnung vor — die Positionen stammen aus der Bestellung. Preise können sich noch ändern.
            </span>
          </div>
        )}

        {/* Articles */}
        <div className="section-title">
          {order.items.length} {order.items.length === 1 ? 'Position' : 'Positionen'}
        </div>

        <div className="card-section" style={{ marginBottom: 28 }}>
          {order.items.map((item, i) => {
            const hasGutschrift = !!item.existingGutschrift
            const hasRetoure = !!item.existingRetoure && !hasGutschrift
            return (
              <div key={item.id} style={hasRetoure ? { borderLeft: '3px solid #3b82f6' } : undefined}>
                {i > 0 && <hr />}
                <div style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', opacity: hasGutschrift ? 0.45 : 1 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                    }}
                  >
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.productName} fill style={{ objectFit: 'cover' }} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 3, lineHeight: 1.35 }}>
                      {item.productName}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {item.sku && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                          {item.sku}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {item.quantity}× · {item.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                      {item.existingRetoure && (
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 6px' }}>
                          Retoure {item.existingRetoure}
                        </span>
                      )}
                      {item.existingGutschrift && (
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: '#ede9fe', color: '#5b21b6', border: '1px solid #ddd6fe', borderRadius: 4, padding: '2px 6px' }}>
                          Gutschrift {item.existingGutschrift}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <Link
          href={`/order/${order.id}/erfassen`}
          className="btn btn-primary btn-lg btn-full"
          style={{ marginBottom: 12, display: 'flex' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
            <path d="M9 2v14M2 9h14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Retoure erfassen
        </Link>
        <Link href="/retouren" className="btn btn-secondary btn-full" style={{ display: 'flex' }}>
          Andere Bestellung suchen
        </Link>
      </div>
    </>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          color: 'var(--text-2)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
