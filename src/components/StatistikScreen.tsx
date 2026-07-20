'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RueckstandTabContent } from '@/components/RueckstandTabContent'
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

const TAB_META = {
  rueckstand: { label: 'Rückstand', color: 'var(--gold-dark)', bg: 'var(--gold-bg)', border: 'var(--gold-border)' },
  retouren: { label: 'Retouren', color: 'var(--blue)', bg: 'var(--blue-bg)', border: 'var(--blue-border)' },
  versand: { label: 'Versand', color: 'var(--purple)', bg: 'var(--purple-bg)', border: 'var(--purple-border)' },
} as const

export default function StatistikScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<'rueckstand' | 'retouren' | 'versand'>('rueckstand')

  return (
    <>
      <header className="page-header">
        <BackButton onClick={() => router.push('/')} />
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>Statistik</span>
      </header>

      {/* Tab switcher */}
      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8 }}>
        {(['rueckstand', 'retouren', 'versand'] as const).map((t) => {
          const active = tab === t
          const meta = TAB_META[t]
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                all: 'unset', cursor: 'pointer',
                padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                border: `1.5px solid ${active ? meta.border : 'var(--border)'}`,
                background: active ? meta.bg : 'var(--surface)',
                color: active ? meta.color : 'var(--text-3)',
                transition: 'all 0.12s',
              }}
            >
              {meta.label}
            </button>
          )
        })}
      </div>

      {tab === 'rueckstand' ? <RueckstandTabContent /> : tab === 'retouren' ? <RetourenTabContent /> : <VersandTabContent />}
    </>
  )
}
