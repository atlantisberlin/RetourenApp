'use client'

import React from 'react'
import Image from 'next/image'
import type { ReplacementProduct, ReturnCondition, ReturnReason } from '@/lib/types'
import { apiGet } from '@/lib/api-client'
import { CameraIcon, DivingIcon } from './icons'

type Photo = { id: string; dataUrl: string; name: string; type: string }

export type ArticleCapture = {
  itemId: string
  productName: string
  imageUrl?: string
  orderedQty: number
  returned: boolean | null
  returnedQuantity: number | null
  condition: string | null
  reason: string | null
  resolution: 'erstattung' | 'umtausch' | null
  replacementProduct: ReplacementProduct | null
  photos: Photo[]
  existingRetoure?: string | null
  existingGutschrift?: string | null
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

type ArticleRowProps = {
  article: ArticleCapture
  onToggleReturned: (val: boolean) => void
  onQuantity: (val: number) => void
  onCondition: (val: string) => void
  onReason: (val: string) => void
  onResolution: (val: 'erstattung' | 'umtausch') => void
  onReplacementProduct: (val: ReplacementProduct | null) => void
  onCapturePhoto: () => void
  onRemovePhoto: (photoId: string) => void
}

export function ArticleRow({ article, onToggleReturned, onQuantity, onCondition, onReason, onResolution, onReplacementProduct, onCapturePhoto, onRemovePhoto }: ArticleRowProps) {
  const [productQuery, setProductQuery] = React.useState('')
  const [productResults, setProductResults] = React.useState<ReplacementProduct[]>([])
  const [productSearching, setProductSearching] = React.useState(false)
  const productSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleProductSearch = (q: string) => {
    setProductQuery(q)
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current)
    if (q.trim().length < 2) { setProductResults([]); return }
    productSearchTimer.current = setTimeout(async () => {
      setProductSearching(true)
      try {
        const data = await apiGet<{ products: ReplacementProduct[] }>(
          `/api/search-products?q=${encodeURIComponent(q)}`
        )
        setProductResults(data.products ?? [])
      } catch { setProductResults([]) }
      setProductSearching(false)
    }, 350)
  }
  const ret = article.returned
  const hasGutschrift = !!article.existingGutschrift
  const hasRetoure = !!article.existingRetoure && !hasGutschrift

  const borderColor = hasGutschrift
    ? 'var(--border)'
    : hasRetoure
    ? 'var(--blue-border)'
    : ret === true
    ? 'var(--blue-border)'
    : 'var(--border)'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1.5px solid ${borderColor}`,
      borderLeft: hasRetoure ? '3px solid var(--blue)' : undefined,
      borderRadius: 12,
      overflow: 'hidden',
      opacity: hasGutschrift ? 0.55 : 1,
      pointerEvents: hasGutschrift ? 'none' : 'auto',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
        {/* Product image */}
        <div style={{ width: 48, height: 48, borderRadius: 8, flexShrink: 0, background: 'var(--surface-3)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {article.imageUrl ? (
            <Image src={article.imageUrl} alt={article.productName} width={48} height={48} style={{ objectFit: 'cover' }} />
          ) : (
            <DivingIcon />
          )}
        </div>

        {/* Name + qty + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {article.productName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {article.orderedQty}× bestellt
            {ret === true && article.condition && article.reason && article.resolution && !hasGutschrift && (
              <span style={{ color: 'var(--green)' }}>✓</span>
            )}
            {hasRetoure && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--blue-bg)', border: '1px solid var(--blue-border)', borderRadius: 4, padding: '1px 5px', color: 'var(--blue)', fontWeight: 600 }}>
                RET {article.existingRetoure}
              </span>
            )}
            {hasGutschrift && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                GS {article.existingGutschrift}
              </span>
            )}
          </div>
        </div>

        {/* Ja / Nein */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onToggleReturned(true)}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${ret === true ? 'var(--blue)' : 'var(--border)'}`,
              background: ret === true ? 'var(--blue)' : 'var(--surface)',
              color: ret === true ? 'white' : 'var(--text-3)',
              transition: 'all 0.12s',
            }}
          >
            Ja
          </button>
          <button
            onClick={() => onToggleReturned(false)}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${ret === false ? 'var(--surface-3)' : 'var(--border)'}`,
              background: ret === false ? 'var(--surface-3)' : 'var(--surface)',
              color: ret === false ? 'var(--text-2)' : 'var(--text-muted)',
              transition: 'all 0.12s',
            }}
          >
            Nein
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {ret === true && (
        <div style={{ borderTop: '1px solid var(--border-2)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-2)' }}>
          {/* Menge */}
          {article.orderedQty > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', width: 56, flexShrink: 0 }}>MENGE</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => onQuantity(Math.max(1, (article.returnedQuantity ?? article.orderedQty) - 1))}
                  style={{ width: 32, height: 32, borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', flexShrink: 0 }}
                >−</button>
                <span style={{ fontSize: 15, fontWeight: 600, minWidth: 60, textAlign: 'center', color: 'var(--text)' }}>
                  {article.returnedQuantity ?? article.orderedQty} / {article.orderedQty}
                </span>
                <button
                  onClick={() => onQuantity(Math.min(article.orderedQty, (article.returnedQuantity ?? article.orderedQty) + 1))}
                  style={{ width: 32, height: 32, borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', flexShrink: 0 }}
                >+</button>
              </div>
            </div>
          )}

          {/* Zustand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', width: 56, flexShrink: 0 }}>ZUSTAND</span>
            <select
              value={article.condition ?? ''}
              onChange={e => onCondition(e.target.value || '')}
              style={{
                flex: 1, padding: '7px 10px',
                border: `1.5px solid ${article.condition ? 'var(--blue-border)' : 'var(--border)'}`,
                borderRadius: 7, fontSize: 13, fontFamily: 'var(--font-sans)',
                color: article.condition ? 'var(--blue)' : 'var(--text-muted)',
                background: article.condition ? 'var(--blue-bg)' : 'var(--surface)',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">Zustand wählen …</option>
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Grund */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', width: 56, flexShrink: 0 }}>GRUND</span>
            <select
              value={article.reason ?? ''}
              onChange={e => onReason(e.target.value || '')}
              style={{
                flex: 1, padding: '7px 10px',
                border: `1.5px solid ${article.reason ? 'var(--blue-border)' : 'var(--border)'}`,
                borderRadius: 7, fontSize: 13, fontFamily: 'var(--font-sans)',
                color: article.reason ? 'var(--blue)' : 'var(--text-muted)',
                background: article.reason ? 'var(--blue-bg)' : 'var(--surface)',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">Rückgabegrund wählen …</option>
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Lösung */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', width: 56, flexShrink: 0 }}>LÖSUNG</span>
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {(['erstattung', 'umtausch'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { onResolution(r); if (r === 'erstattung') onReplacementProduct(null) }}
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${article.resolution === r ? 'var(--blue)' : 'var(--border)'}`,
                    background: article.resolution === r ? 'var(--blue)' : 'var(--surface)',
                    color: article.resolution === r ? 'white' : 'var(--text-3)',
                    transition: 'all 0.12s',
                  }}
                >
                  {r === 'erstattung' ? 'Erstattung' : 'Umtausch'}
                </button>
              ))}
            </div>
          </div>

          {/* Umtausch-Artikel suchen */}
          {article.resolution === 'umtausch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', width: 56, flexShrink: 0 }}>ARTIKEL</span>
                {article.replacementProduct ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, background: 'var(--blue-bg)', border: '1.5px solid var(--blue-border)' }}>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {article.replacementProduct.name}
                      {article.replacementProduct.sku && <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>{article.replacementProduct.sku}</span>}
                    </span>
                    <button onClick={() => { onReplacementProduct(null); setProductQuery(''); setProductResults([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Artikelname, SKU oder EAN …"
                    value={productQuery}
                    onChange={e => handleProductSearch(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, fontSize: 13, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontFamily: 'var(--font-sans)' }}
                  />
                )}
              </div>
              {!article.replacementProduct && productResults.length > 0 && (
                <div style={{ marginLeft: 66, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
                  {productResults.map(p => (
                    <button
                      key={p.productId}
                      onClick={() => { onReplacementProduct(p); setProductQuery(''); setProductResults([]) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-2)', cursor: 'pointer', fontSize: 13 }}
                    >
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                      {p.sku && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{p.sku}</span>}
                      {p.ean && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{p.ean}</span>}
                    </button>
                  ))}
                  {productSearching && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Suche …</div>}
                </div>
              )}
            </div>
          )}

          {/* Fotos */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', width: 56, flexShrink: 0, paddingTop: 8 }}>
              {article.photos.length > 1 ? 'FOTOS' : 'FOTO'}
            </span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {article.photos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {article.photos.map((photo) => (
                    <div key={photo.id} style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.dataUrl} alt="Artikel" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
                      <button
                        onClick={() => onRemovePhoto(photo.id)}
                        style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'var(--red)', color: '#fff', fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={onCapturePhoto} style={{ padding: '7px 10px', borderRadius: 7, fontSize: 13, border: '1.5px dashed var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CameraIcon size={14} /> {article.photos.length > 0 ? 'Weiteres Foto' : 'Foto aufnehmen (optional)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
