export function DivingIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" style={{ color: 'var(--text-muted)', opacity: 0.45 }}>
      <rect x="3" y="9" width="20" height="10" rx="3" stroke="currentColor" strokeWidth="1.4"/>
      <ellipse cx="9" cy="14" rx="3.5" ry="2.8" stroke="currentColor" strokeWidth="1.4"/>
      <ellipse cx="17" cy="14" rx="3.5" ry="2.8" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M12.5 14h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M3 12 Q1 12 1 15 Q1 19 4 19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <path d="M23 12 Q25 12 25 15 Q25 19 22 19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

export function CameraIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M5.5 2L4 4H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2L10.5 2h-5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <circle cx="8" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export function SearchSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="9" cy="9" r="7" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ButtonSpinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <path d="M9 2a7 7 0 0 1 7 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function AsanaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="6" r="3" fill="white" opacity="0.9" />
      <circle cx="4" cy="12" r="3" fill="white" opacity="0.7" />
      <circle cx="14" cy="12" r="3" fill="white" opacity="0.7" />
    </svg>
  )
}
