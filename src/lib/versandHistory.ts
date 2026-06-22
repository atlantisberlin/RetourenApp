export type VersandEntry = {
  id: string
  carrier: string
  trackingNumber: string
  deliveryNote: string
  insuranceValue: string
  notes: string
  operatorName: string
  submittedAt: string
  taskId?: string
}

const KEY = 'versand_history'
const MAX = 100

export function getVersandHistory(): VersandEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function addToVersandHistory(entry: Omit<VersandEntry, 'id'>): void {
  const history = getVersandHistory()
  history.unshift({ ...entry, id: Date.now().toString() })
  if (history.length > MAX) history.splice(MAX)
  localStorage.setItem(KEY, JSON.stringify(history))
}

export function deleteFromVersandHistory(id: string): void {
  const history = getVersandHistory().filter((e) => e.id !== id)
  localStorage.setItem(KEY, JSON.stringify(history))
}
