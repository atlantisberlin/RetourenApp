'use client'

import Link from 'next/link'
import type { Order } from '@/lib/types'

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
  return (
    <>
      <header className="page-header">
        <Link
          href="/"
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
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{order.customerName}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                KD {order.customerNumber}
                {order.customerEmail ? ` · ${order.customerEmail}` : ''}
              </div>
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
            {order.deliveryNoteNumber && <MetaRow label="Lieferscheinnr." value={order.deliveryNoteNumber} mono />}
            <MetaRow label="Herkunft" value={order.source ?? 'Zentrallager'} />
          </div>
        </div>

        {/* Articles */}
        <div className="section-title">
          {order.items.length} {order.items.length === 1 ? 'Position' : 'Positionen'}
        </div>

        <div className="card-section" style={{ marginBottom: 28 }}>
          {order.items.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <hr />}
              <div style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
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
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 3, lineHeight: 1.35 }}>
                    {item.productName}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {item.sku && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.sku}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {item.quantity}× · {item.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
        <Link href="/" className="btn btn-secondary btn-full" style={{ display: 'flex' }}>
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
