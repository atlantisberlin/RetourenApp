'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RetourenTabContent } from '@/components/RetourenTabContent'
import { VersandTabContent } from '@/components/VersandTabContent'

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', padding: '8px 4px' }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontSize: 14 }}>Zurück</span>
    </button>
  )
}

export default function StatistikScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<'retouren' | 'versand'>('retouren')

  return (
    <>
      <header className="page-header">
        <BackButton onClick={() => router.push('/')} />
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Statistik</span>
      </header>

      {/* Tab switcher */}
      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8 }}>
        {(['retouren', 'versand'] as const).map((t) => {
          const active = tab === t
          const color = t === 'retouren' ? 'var(--blue)' : 'var(--purple)'
          const bgActive = t === 'retouren' ? 'var(--blue-bg)' : 'var(--purple-bg)'
          const borderActive = t === 'retouren' ? 'var(--blue-border)' : 'var(--purple-border)'
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                border: `1.5px solid ${active ? borderActive : 'var(--border)'}`,
                background: active ? bgActive : 'var(--surface)',
                color: active ? color : 'var(--text-3)',
                transition: 'all 0.12s',
              }}
            >
              {t === 'retouren' ? 'Retouren' : 'Versand'}
            </button>
          )
        })}
      </div>

      {tab === 'retouren' ? <RetourenTabContent /> : <VersandTabContent />}
    </>
  )
}
