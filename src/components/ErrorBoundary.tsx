'use client'

import React, { ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ? (
          this.props.fallback(this.state.error!, this.resetError)
        ) : (
          <DefaultErrorFallback error={this.state.error!} onReset={this.resetError} />
        )
      )
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--surface)',
      padding: '20px',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '500px' }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--red-bg)',
          border: '2px solid var(--red-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="var(--red)" />
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
          Etwas ist schiefgelaufen
        </h2>

        <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.6 }}>
          Die Anwendung hat einen unerwarteten Fehler festgestellt. Versuchen Sie, die Seite neu zu laden oder gehen Sie zur Startseite.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details style={{
            marginBottom: 24,
            padding: '12px',
            background: 'var(--surface-2)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            textAlign: 'left',
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>
              Fehlerdetails (nur in der Entwicklung sichtbar)
            </summary>
            <pre style={{
              overflow: 'auto',
              fontSize: 12,
              color: 'var(--red-dark)',
              fontFamily: 'var(--font-mono)',
              margin: 0,
            }}>
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
          <button
            onClick={onReset}
            style={{
              padding: '12px 24px',
              background: 'var(--red)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Versuchen Sie es erneut
          </button>

          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '12px 24px',
              background: 'var(--surface-3)',
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Zur Startseite
          </button>
        </div>
      </div>
    </div>
  )
}
