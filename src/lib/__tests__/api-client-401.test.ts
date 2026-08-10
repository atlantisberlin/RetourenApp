/**
 * Verifiziert, dass ein 401 (abgelaufene/ungültige Mitarbeiter-Sitzung) den
 * Mitarbeiter automatisch abmeldet (clearOperator verwirft Name + JWT) und dies
 * bei einer Debounce-Suche nur EINMAL tut — statt den Fehler still zu schlucken
 * und den Nutzer auf einer leeren Suche sitzen zu lassen. jest.resetModules()
 * vor jedem Test setzt das interne „redirectingToLogin"-Flag im Modul zurück.
 *
 * Die anschließende harte Weiterleitung (window.location.assign) lässt sich in
 * dieser gesperrten jsdom-Location nicht abfangen und wird daher nicht
 * assertet; sie ist triviale Folgecode-Zeile nach clearOperator().
 */
describe('api-client – 401 / Sitzung abgelaufen', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  afterAll(() => {
    errorSpy.mockRestore()
  })

  async function setup(pathname: string) {
    // pathname steuern, ohne die (gesperrte) location zu ersetzen.
    window.history.pushState({}, '', pathname)
    const clearOperator = jest.fn()
    jest.doMock('../operator', () => ({ clearOperator }))
    jest.doMock('../client-session', () => ({ getSessionToken: () => 'expired-token' }))
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Unauthorized: Invalid or expired session' }),
    }) as unknown as typeof fetch
    const mod = await import('../api-client')
    return { mod, clearOperator }
  }

  it('meldet den Mitarbeiter bei 401 der Suche automatisch ab', async () => {
    const { mod, clearOperator } = await setup('/retouren')
    await expect(mod.apiGet('/api/search?q=test')).rejects.toThrow()
    expect(clearOperator).toHaveBeenCalledTimes(1)
  })

  it('meldet auch bei POST-Endpunkten (z. B. Versand) ab', async () => {
    const { mod, clearOperator } = await setup('/versand')
    await expect(mod.apiPost('/api/versand', {})).rejects.toThrow()
    expect(clearOperator).toHaveBeenCalledTimes(1)
  })

  it('meldet bei mehreren 401 in Folge nur EINMAL ab (Debounce-Suche)', async () => {
    const { mod, clearOperator } = await setup('/retouren')
    await expect(mod.apiGet('/api/search?q=a')).rejects.toThrow()
    await expect(mod.apiGet('/api/search?q=ab')).rejects.toThrow()
    await expect(mod.apiGet('/api/search?q=abc')).rejects.toThrow()
    expect(clearOperator).toHaveBeenCalledTimes(1)
  })

  it('meldet bei anderen Fehlern (z. B. 400/500) NICHT ab', async () => {
    window.history.pushState({}, '', '/retouren')
    const clearOperator = jest.fn()
    jest.doMock('../operator', () => ({ clearOperator }))
    jest.doMock('../client-session', () => ({ getSessionToken: () => 'valid-token' }))
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ error: 'boom' }),
    }) as unknown as typeof fetch
    const mod = await import('../api-client')
    await expect(mod.apiGet('/api/search?q=test')).rejects.toThrow()
    expect(clearOperator).not.toHaveBeenCalled()
  })
})
