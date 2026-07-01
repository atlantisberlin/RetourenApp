import * as clientSession from '../client-session'
import { apiPost, apiCall, apiDelete } from '../api-client'

// Mock client-session
jest.mock('../client-session')

// Mock fetch
global.fetch = jest.fn()

describe('api-client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(clientSession.getSessionToken as jest.Mock).mockReturnValue(null)
  })

  describe('apiPost', () => {
    it('should send POST request with data', async () => {
      const mockData = { success: true, taskId: '123' }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await apiPost('/api/submit', { test: 'data' })

      expect(result).toEqual(mockData)
      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[0]).toBe('/api/submit')
      expect(call[1].method).toBe('POST')
      expect(call[1].body).toBe(JSON.stringify({ test: 'data' }))
      expect(call[1].headers.get('Content-Type')).toBe('application/json')
    })

    it('should include JWT token in Authorization header', async () => {
      ;(clientSession.getSessionToken as jest.Mock).mockReturnValue('test-jwt-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await apiPost('/api/test', {})

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[1].headers.get('Authorization')).toBe('Bearer test-jwt-token')
    })

    it('should not include Authorization header if no token', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await apiPost('/api/test', {})

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[1].headers.get('Authorization')).toBeNull()
    })

    it('should throw error on failed response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({}),
      })

      await expect(apiPost('/api/test', {})).rejects.toThrow()
    })

    it('should parse JSON response', async () => {
      const mockData = { result: 'success', value: 42 }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await apiPost('/api/test', {})

      expect(result).toEqual(mockData)
    })
  })

  describe('apiDelete', () => {
    it('should send DELETE request', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await apiDelete('/api/session')

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[1].method).toBe('DELETE')
    })

    it('should include JWT token in Authorization header', async () => {
      ;(clientSession.getSessionToken as jest.Mock).mockReturnValue('test-jwt-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await apiDelete('/api/session')

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[1].headers.get('Authorization')).toBe('Bearer test-jwt-token')
    })
  })

  describe('apiCall', () => {
    it('should be flexible with different HTTP methods', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await apiCall('/api/test', { method: 'PATCH' })

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[1].method).toBe('PATCH')
    })

    it('should merge headers correctly', async () => {
      ;(clientSession.getSessionToken as jest.Mock).mockReturnValue('my-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await apiCall('/api/test', {
        method: 'GET',
        headers: { 'X-Custom': 'value' },
      })

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[1].headers.get('Authorization')).toBe('Bearer my-token')
      expect(call[1].headers.get('X-Custom')).toBe('value')
    })
  })
})
