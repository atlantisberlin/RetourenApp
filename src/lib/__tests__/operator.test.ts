import { getOperator, setOperator, clearOperator, refreshActivity, isOperatorActive } from '../operator'

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

// clearOperator() ruft clearSession(), das per fetch() ein Logout-Audit
// absetzt — im Test nur mocken, damit der Aufruf nicht mit „fetch is not
// defined" scheitert.
global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as unknown as typeof fetch

describe('operator', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllTimers()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('setOperator', () => {
    it('should store operator name and timestamp', () => {
      setOperator('Erik')

      expect(localStorage.getItem('operator_name')).toBe('Erik')
      expect(localStorage.getItem('operator_ts')).toBeTruthy()
    })

    it('should update timestamp on multiple calls', () => {
      setOperator('Erik')
      const ts1 = localStorage.getItem('operator_ts')

      jest.advanceTimersByTime(5000)

      setOperator('Erik')
      const ts2 = localStorage.getItem('operator_ts')

      expect(ts1).not.toBe(ts2)
      expect(Number(ts2)).toBeGreaterThan(Number(ts1))
    })
  })

  describe('getOperator', () => {
    it('should return operator if valid and not idle', () => {
      setOperator('Josi')

      expect(getOperator()).toBe('Josi')
    })

    it('should return null if no operator set', () => {
      expect(getOperator()).toBeNull()
    })

    it('should return null if operator is idle (10+ minutes)', () => {
      setOperator('Ute')

      // Advance time by 10 minutes and 1 second
      jest.advanceTimersByTime(10 * 60 * 1000 + 1000)

      expect(getOperator()).toBeNull()
    })

    it('should return operator if under idle timeout', () => {
      setOperator('Sascha')

      // Advance time by 9 minutes (less than 10)
      jest.advanceTimersByTime(9 * 60 * 1000)

      expect(getOperator()).toBe('Sascha')
    })

    it('should clear operator when idle timeout exceeded', () => {
      setOperator('Erik')

      jest.advanceTimersByTime(10 * 60 * 1000 + 1000)

      getOperator()

      // After calling getOperator with exceeded timeout, both should be removed
      expect(localStorage.getItem('operator_name')).toBeNull()
      expect(localStorage.getItem('operator_ts')).toBeNull()
    })
  })

  describe('clearOperator', () => {
    it('should remove operator name and timestamp', () => {
      setOperator('Erik')

      clearOperator()

      expect(localStorage.getItem('operator_name')).toBeNull()
      expect(localStorage.getItem('operator_ts')).toBeNull()
    })

    it('should work even if no operator is set', () => {
      // Should not throw
      expect(() => clearOperator()).not.toThrow()
    })
  })

  describe('refreshActivity', () => {
    it('should update timestamp if operator exists', () => {
      setOperator('Josi')
      const ts1 = localStorage.getItem('operator_ts')

      jest.advanceTimersByTime(5000)

      refreshActivity()

      const ts2 = localStorage.getItem('operator_ts')
      expect(ts2).not.toBe(ts1)
      expect(Number(ts2)).toBeGreaterThan(Number(ts1))
    })

    it('should not set timestamp if no operator exists', () => {
      refreshActivity()

      expect(localStorage.getItem('operator_ts')).toBeNull()
    })

    it('should keep operator from timing out when refreshing regularly', () => {
      setOperator('Ute')

      // Refresh every 5 minutes, total 15 minutes
      jest.advanceTimersByTime(5 * 60 * 1000)
      refreshActivity()

      jest.advanceTimersByTime(5 * 60 * 1000)
      refreshActivity()

      jest.advanceTimersByTime(5 * 60 * 1000)
      refreshActivity()

      // Should still be valid
      expect(getOperator()).toBe('Ute')
    })
  })

  describe('isOperatorActive', () => {
    it('should return false if no operator is set', () => {
      expect(isOperatorActive()).toBe(false)
    })

    it('should return true for a freshly set operator', () => {
      setOperator('Erik')

      expect(isOperatorActive()).toBe(true)
    })

    it('should return false once the idle timeout is exceeded', () => {
      setOperator('Josi')

      jest.advanceTimersByTime(10 * 60 * 1000 + 1000)

      expect(isOperatorActive()).toBe(false)
    })

    it('should NOT log the operator out (no side effect) when idle', () => {
      setOperator('Ute')

      jest.advanceTimersByTime(10 * 60 * 1000 + 1000)
      isOperatorActive()

      // Anders als getOperator() darf isOperatorActive() nichts abmelden.
      expect(localStorage.getItem('operator_name')).toBe('Ute')
      expect(localStorage.getItem('operator_ts')).toBeTruthy()
    })
  })
})
