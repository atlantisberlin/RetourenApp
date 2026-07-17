'use client'

import { ArticleRow, type ArticleCapture } from '@/components/retouren-wizard/ArticleRow'

interface Step3SelectArticlesProps {
  articles: ArticleCapture[]
  onUpdateArticle: (idx: number, patch: Partial<ArticleCapture>) => void
  onCapturePhoto: (idx: number) => void
  onRemovePhoto: (idx: number, photoId: string) => void
}

export function Step3SelectArticles({
  articles,
  onUpdateArticle,
  onCapturePhoto,
  onRemovePhoto,
}: Step3SelectArticlesProps) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Artikel prüfen</h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Welche Artikel wurden zurückgeschickt?
        </p>
      </div>

      {/* Summary pill */}
      {articles.some(a => a.returned !== null) && (
        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 12 }}>
          {articles.filter(a => a.returned === true).length} von {articles.length} zurückgekommen
          {articles.filter(a => a.returned === null).length > 0 && (
            <span style={{ color: 'var(--gold)' }}> · {articles.filter(a => a.returned === null).length} noch offen</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {articles.map((art, idx) => (
          <ArticleRow
            key={art.itemId}
            article={art}
            onToggleReturned={(val) => onUpdateArticle(idx, val ? { returned: true } : { returned: false, returnedQuantity: null, condition: null, reason: null, resolution: null, replacementProduct: null, photos: [], reklamation: false })}
            onQuantity={(val) => onUpdateArticle(idx, { returnedQuantity: val })}
            onCondition={(val) => onUpdateArticle(idx, val === 'gut' ? { condition: val, reklamation: false } : { condition: val })}
            onReason={(val) => onUpdateArticle(idx, { reason: val })}
            onResolution={(val) => onUpdateArticle(idx, { resolution: val })}
            onReplacementProduct={(val) => onUpdateArticle(idx, { replacementProduct: val })}
            onReklamation={(val) => onUpdateArticle(idx, { reklamation: val })}
            onCapturePhoto={() => onCapturePhoto(idx)}
            onRemovePhoto={(photoId) => onRemovePhoto(idx, photoId)}
          />
        ))}
      </div>
    </div>
  )
}
