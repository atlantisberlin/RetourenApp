import { clearSession } from './client-session'

export const OPERATORS = ['Erik', 'Josi', 'Ute', 'Sascha'] as const
export type Operator = typeof OPERATORS[number]

const KEY_NAME = 'operator_name'
const KEY_TS   = 'operator_ts'
const IDLE_MS  = 10 * 60 * 1000

export function getOperator(): string | null {
  if (typeof window === 'undefined') return null
  const name = localStorage.getItem(KEY_NAME)
  const ts   = localStorage.getItem(KEY_TS)
  if (!name || !ts) return null
  if (Date.now() - Number(ts) > IDLE_MS) {
    clearOperator()
    return null
  }
  return name
}

export function setOperator(name: string): void {
  localStorage.setItem(KEY_NAME, name)
  localStorage.setItem(KEY_TS, String(Date.now()))
}

export function clearOperator(): void {
  localStorage.removeItem(KEY_NAME)
  localStorage.removeItem(KEY_TS)
  // Löscht auch das JWT-Sitzungs-Token — sonst bleibt es beim Mitarbeiter-
  // Wechsel gültig in localStorage liegen, bis der nächste Login es überschreibt
  clearSession()
}

export function refreshActivity(): void {
  if (localStorage.getItem(KEY_NAME)) {
    localStorage.setItem(KEY_TS, String(Date.now()))
  }
}

/**
 * Wie getOperator(), aber OHNE Seiteneffekt: prüft nur, ob ein Mitarbeiter
 * innerhalb des Idle-Fensters aktiv ist, ohne ihn bei Ablauf abzumelden.
 * Für Hintergrund-Checks (stiller Token-Refresh), die selbst keinen Logout
 * auslösen sollen — der reguläre Idle-Logout bleibt getOperator() vorbehalten.
 */
export function isOperatorActive(): boolean {
  if (typeof window === 'undefined') return false
  const name = localStorage.getItem(KEY_NAME)
  const ts = localStorage.getItem(KEY_TS)
  if (!name || !ts) return false
  return Date.now() - Number(ts) <= IDLE_MS
}
