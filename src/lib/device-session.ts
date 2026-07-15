/**
 * Client-side helper for the device-level access gate.
 * The device token itself lives in an HttpOnly cookie set by the server —
 * nothing to store here client-side.
 */
export async function unlockDevice(code: string): Promise<void> {
  const response = await fetch('/api/auth/device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean
    error?: string
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Anmeldung fehlgeschlagen')
  }
}
