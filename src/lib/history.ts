export type HistoryEntry = {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  customerNumber: string
  operatorName: string
  submittedAt: string
  itemCount: number
  items: Array<{ productName: string; condition: string; reason: string; resolution: string }>
  taskId?: string
}

const KEY = 'return_history'
const MAX = 100

export function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function addToHistory(entry: Omit<HistoryEntry, 'id'>): void {
  const history = getHistory()
  history.unshift({ ...entry, id: Date.now().toString() })
  if (history.length > MAX) history.splice(MAX)
  localStorage.setItem(KEY, JSON.stringify(history))
}

export function getCustomerHistory(customerNumber: string): HistoryEntry[] {
  return getHistory().filter((e) => e.customerNumber === customerNumber)
}
