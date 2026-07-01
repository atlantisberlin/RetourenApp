import {
  createSession,
  getSessionToken,
  clearSession,
  hasSession,
} from '../client-session'

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
