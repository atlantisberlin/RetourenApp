import {
  createSession,
  getSessionToken,
  getSessionExpiry,
  refreshSession,
  clearSession,
  hasSession,
} from '../client-session'

// Baut ein JWT-ähnliches Token (header.payload.signature) mit base64url-
// codierter Payload — reicht, da getSessionExpiry nur die Payload dekodiert.
function makeToken(payload: Record<string, unknown>): string {
  const b64url = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock fetch
global.fetch = jest.fn()

describe('client-session', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  describe('createSession', () => {
    it('should store token and operator name in localStorage', async () => {
      const mockResponse = {
        success: true,
        data: {
          token: 'test-jwt-token',
          expiresIn: '24h',
          operatorName: 'Erik',
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await createSession('Erik')

      expect(localStorage.getItem('retouren_session_token')).toBe('test-jwt-token')
      expect(localStorage.getItem('operator_name')).toBe('Erik')
      expect(localStorage.getItem('operator_ts')).toBeTruthy()
    })

    it('should call POST /api/auth/session with operatorName', async () => {
      const mockResponse = {
        success: true,
        data: {
          token: 'test-token',
          expiresIn: '24h',
          operatorName: 'Josi',
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await createSession('Josi')

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName: 'Josi' }),
      })
    })

    it('should throw error on failed response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Internal error' }),
      })

      await expect(createSession('Erik')).rejects.toThrow()
    })

    it('should return token', async () => {
      const mockResponse = {
        success: true,
        data: {
          token: 'test-jwt-token',
          expiresIn: '24h',
          operatorName: 'Erik',
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const token = await createSession('Erik')

      expect(token).toBe('test-jwt-token')
    })
  })

  describe('getSessionToken', () => {
    it('should return stored token', () => {
      localStorage.setItem('retouren_session_token', 'my-token')

      expect(getSessionToken()).toBe('my-token')
    })

    it('should return null if no token stored', () => {
      expect(getSessionToken()).toBeNull()
    })
  })

  describe('clearSession', () => {
    it('should remove all session data from localStorage', async () => {
      localStorage.setItem('retouren_session_token', 'token')
      localStorage.setItem('operator_name', 'Erik')
      localStorage.setItem('operator_ts', '123456')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

      clearSession()

      expect(localStorage.getItem('retouren_session_token')).toBeNull()
      expect(localStorage.getItem('operator_name')).toBeNull()
      expect(localStorage.getItem('operator_ts')).toBeNull()
    })

    it('should call DELETE /api/auth/session', () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

      clearSession()

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/session', {
        method: 'DELETE',
      })
    })
  })

  describe('getSessionExpiry', () => {
    it('should return the exp claim from the stored token', () => {
      localStorage.setItem('retouren_session_token', makeToken({ operator: 'Erik', exp: 1234567890 }))

      expect(getSessionExpiry()).toBe(1234567890)
    })

    it('should return null if no token is stored', () => {
      expect(getSessionExpiry()).toBeNull()
    })

    it('should return null for a malformed token', () => {
      localStorage.setItem('retouren_session_token', 'not-a-jwt')

      expect(getSessionExpiry()).toBeNull()
    })

    it('should return null if the payload has no exp', () => {
      localStorage.setItem('retouren_session_token', makeToken({ operator: 'Erik' }))

      expect(getSessionExpiry()).toBeNull()
    })
  })

  describe('refreshSession', () => {
    it('should PUT with the current token and store the new token on success', async () => {
      localStorage.setItem('retouren_session_token', 'old-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { token: 'fresh-token' } }),
      })

      const ok = await refreshSession()

      expect(ok).toBe(true)
      expect(localStorage.getItem('retouren_session_token')).toBe('fresh-token')
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/session', {
        method: 'PUT',
        headers: { Authorization: 'Bearer old-token' },
      })
    })

    it('should NOT touch operator_ts (idle timer must keep running)', async () => {
      localStorage.setItem('retouren_session_token', 'old-token')
      localStorage.setItem('operator_ts', '111')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { token: 'fresh-token' } }),
      })

      await refreshSession()

      expect(localStorage.getItem('operator_ts')).toBe('111')
    })

    it('should return false and keep the old token if no token is stored', async () => {
      const ok = await refreshSession()

      expect(ok).toBe(false)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should return false and keep the old token on a non-ok response', async () => {
      localStorage.setItem('retouren_session_token', 'old-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false }),
      })

      const ok = await refreshSession()

      expect(ok).toBe(false)
      expect(localStorage.getItem('retouren_session_token')).toBe('old-token')
    })

    it('should return false on a network error', async () => {
      localStorage.setItem('retouren_session_token', 'old-token')

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))

      const ok = await refreshSession()

      expect(ok).toBe(false)
      expect(localStorage.getItem('retouren_session_token')).toBe('old-token')
    })
  })

  describe('hasSession', () => {
    it('should return true if token exists', () => {
      localStorage.setItem('retouren_session_token', 'token')

      expect(hasSession()).toBe(true)
    })

    it('should return false if no token', () => {
      expect(hasSession()).toBe(false)
    })
  })
})
