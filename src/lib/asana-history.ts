import type { HistoryEntry } from './history'
import type { VersandEntry } from './versandHistory'

type AsanaTaskRaw = {
  gid: string
  created_at: string
  html_notes?: string | null
  notes?: string | null
  name?: string
  tags?: { name: string }[]
}

export type BacklogEntry = {
  taskGid: string
  orderNumber: string
  customerName: string
  source: string
  originTags: string[]
  createdAt: string
  overdueInvoice: boolean
  needsRetoure: boolean
  needsGutschrift: boolean
  needsUmtausch: boolean
  isOpen: boolean
  resolvedAt: string | null
  firstProductName: string
  itemCount: number
}

type AsanaSubtaskRaw = {
  name: string
  completed: boolean
  completed_at: string | null
}

async function fetchAllProjectTasks(
  projectGid: string,
  token: string,
  optFields: string,
  maxPages = 3
): Promise<AsanaTaskRaw[]> {
  const tasks: AsanaTaskRaw[] = []
  let offset: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`https://app.asana.com/api/1.0/projects/${projectGid}/tasks`)
    url.searchParams.set('opt_fields', optFields)
    url.searchParams.set('limit', '100')
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      console.error('Asana task list fetch failed:', res.status, await res.text())
      break
    }
    const json = await res.json()
    tasks.push(...(json.data ?? []))
    offset = json.next_page?.offset
    if (!offset) break
  }

  return tasks
}

// Asana bietet keinen Weg, Unteraufgaben direkt in der Projekt-Task-Liste
// mitzuladen (opt_fields deckt das nicht ab) — pro Aufgabe ist ein eigener
// Request an /tasks/{gid}/subtasks nötig. Begrenzte Parallelität hält das
// im Rahmen von Asanas Rate-Limit, statt alle Requests gleichzeitig abzufeuern.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fetchSubtasks(taskGid: string, token: string): Promise<AsanaSubtaskRaw[]> {
  const url = new URL(`https://app.asana.com/api/1.0/tasks/${taskGid}/subtasks`)
  url.searchParams.set('opt_fields', 'name,completed,completed_at')
  url.searchParams.set('limit', '20')

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.error('Asana Unteraufgaben-Fetch fehlgeschlagen:', res.status, await res.text())
    return []
  }
  const json = await res.json()
  return json.data ?? []
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function extractLi(html: string, label: string): string | undefined {
  const re = new RegExp(`<li>${escapeRegExp(label)}:\\s*([^<]*)</li>`, 'i')
  const m = html.match(re)
  return m ? decodeHtmlEntities(m[1]).trim() : undefined
}

function extractItemLines(html: string): string[] {
  const m = html.match(/Zurückgekommene Positionen<\/h2><ul>([\s\S]*?)<\/ul>/)
  if (!m) return []
  return [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((mm) => decodeHtmlEntities(mm[1]))
}

const REASON_BY_LABEL: Record<string, string> = {
  'Gefällt nicht': 'gefaellt_nicht',
  'Falsch geliefert': 'falsch_geliefert',
  'Defekt bei Ankunft': 'defekt_bei_ankunft',
  'Größe passt nicht': 'groesse_passt_nicht',
  'Beschädigt bei Lieferung': 'beschaedigt_bei_lieferung',
  Sonstiges: 'sonstiges',
}

const CONDITION_BY_LABEL: Record<string, string> = {
  Gut: 'gut',
  Beschädigt: 'beschaedigt',
  Unvollständig: 'unvollstaendig',
  Defekt: 'defekt',
}

// Erwartet exakt das Format, das submit/route.ts erzeugt:
// "{name} | {qty}x - Zustand: {cond} - Grund: {reason} - {resolution}..."
const ITEM_LINE_RE = /^(.*?) \| (\d+)x - Zustand: (.*?) - Grund: (.*?) - (Erstattung|Umtausch)/

function parseItemLine(content: string): { productName: string; condition: string; reason: string; resolution: string } {
  const m = content.match(ITEM_LINE_RE)
  if (!m) return { productName: content, condition: '', reason: '', resolution: '' }
  const [, name, , condLabel, reasonLabel, resolutionLabel] = m
  return {
    productName: name.trim(),
    condition: CONDITION_BY_LABEL[condLabel.trim()] ?? condLabel.trim(),
    reason: REASON_BY_LABEL[reasonLabel.trim()] ?? reasonLabel.trim(),
    resolution: resolutionLabel === 'Erstattung' ? 'erstattung' : 'umtausch',
  }
}

// Liest nur Aufgaben, die submit/route.ts im HTML-Listenformat angelegt hat.
// Aufgaben aus dem Plain-Text-Fallback (wenn Asana html_notes mal ablehnt)
// haben keine <li>-Struktur und werden übersprungen statt geraten zu parsen.
function parseRetoureTask(task: AsanaTaskRaw): HistoryEntry | null {
  const html = task.html_notes ?? ''
  if (!html.includes('<li>')) return null

  const items = extractItemLines(html).map(parseItemLine)
  if (items.length === 0) return null

  return {
    id: task.gid,
    orderId: '',
    orderNumber: extractLi(html, 'Bestellnr.') ?? '',
    customerName: extractLi(html, 'Kunde') ?? '',
    customerNumber: extractLi(html, 'Kundennr.') ?? '',
    operatorName: extractLi(html, 'Bearbeitet von') ?? 'Unbekannt',
    submittedAt: task.created_at,
    itemCount: items.length,
    items,
    taskId: task.gid,
  }
}

function parseVersandTask(task: AsanaTaskRaw): VersandEntry | null {
  const notes = task.notes ?? ''
  const lines = notes.split('\n').map((l) => l.trim())
  const get = (prefix: string) => {
    const line = lines.find((l) => l.startsWith(prefix))
    return line ? line.slice(prefix.length).trim() : ''
  }

  const trackingNumber = get('Trackingnummer:')
  if (!trackingNumber) return null

  return {
    id: task.gid,
    carrier: get('Logistikunternehmen:'),
    trackingNumber,
    deliveryNote: get('Lieferscheinnummer:'),
    insuranceValue: get('Versicherungssumme:').replace(/^€/, ''),
    notes: get('Bemerkungen:'),
    operatorName: get('Dokumentiert von:') || 'Unbekannt',
    submittedAt: task.created_at,
    taskId: task.gid,
  }
}

// Unteraufgaben-Namen, wie submit/route.ts sie anlegt (siehe dort) — nur
// deren "completed"-Status entscheidet, ob eine Retoure noch offen ist.
// "Paket angenommen" wird nicht geprüft: die existiert immer und ist beim
// Anlegen bereits completed, blockiert also nie den Rückstand.
const RETOURE_SUBTASK_RE = /^Retoure angelegt/
const GUTSCHRIFT_SUBTASK_RE = /^Gutschrift geschrieben/
const UMTAUSCH_SUBTASK_RE = /^Umtausch gemacht/

function parseBacklogTask(task: AsanaTaskRaw, subtasks: AsanaSubtaskRaw[]): BacklogEntry | null {
  const html = task.html_notes ?? ''
  if (!html.includes('<li>')) return null

  const items = extractItemLines(html).map(parseItemLine)
  if (items.length === 0) return null

  const findSub = (re: RegExp) => subtasks.find((s) => re.test(s.name))
  const retoureSub = findSub(RETOURE_SUBTASK_RE)
  const gutschriftSub = findSub(GUTSCHRIFT_SUBTASK_RE)
  const umtauschSub = findSub(UMTAUSCH_SUBTASK_RE)
  const actionable = [retoureSub, gutschriftSub, umtauschSub].filter((s): s is AsanaSubtaskRaw => !!s)

  const isOpen = actionable.length === 0 || actionable.some((s) => !s.completed)
  const resolvedAt = isOpen
    ? null
    : actionable.reduce<string | null>((latest, s) => {
        if (!s.completed_at) return latest
        if (!latest || new Date(s.completed_at) > new Date(latest)) return s.completed_at
        return latest
      }, null) ?? task.created_at

  // Titel-Format aus submit/route.ts: "Retoure (Nr) - {source} - {date} - {tracking} - {kunde}"
  const source = (task.name ?? '').split(' - ')[1] ?? ''

  return {
    taskGid: task.gid,
    orderNumber: extractLi(html, 'Bestellnr.') ?? '',
    customerName: extractLi(html, 'Kunde') ?? '',
    source,
    originTags: (task.tags ?? []).map((t) => t.name),
    createdAt: task.created_at,
    overdueInvoice: /Achtung: Rechnung vom/.test(html),
    needsRetoure: !!retoureSub && !retoureSub.completed,
    needsGutschrift: !!gutschriftSub && !gutschriftSub.completed,
    needsUmtausch: !!umtauschSub && !umtauschSub.completed,
    isOpen,
    resolvedAt,
    firstProductName: items[0]?.productName ?? '',
    itemCount: items.length,
  }
}

export function isAsanaHistoryConfigured(): boolean {
  return !!(process.env.ASANA_TOKEN?.trim() && process.env.ASANA_PROJECT_GID?.trim())
}

export function isAsanaVersandHistoryConfigured(): boolean {
  return !!(process.env.ASANA_TOKEN?.trim() && process.env.ASANA_VERSAND_PROJECT_GID?.trim())
}

export async function fetchRetourenHistory(): Promise<HistoryEntry[]> {
  const token = process.env.ASANA_TOKEN?.trim()
  const projectGid = process.env.ASANA_PROJECT_GID?.trim()
  if (!token || !projectGid) return []

  const tasks = await fetchAllProjectTasks(projectGid, token, 'html_notes,created_at')
  return tasks
    .map(parseRetoureTask)
    .filter((e): e is HistoryEntry => e !== null)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
}

export async function fetchRetourenBacklog(): Promise<BacklogEntry[]> {
  const token = process.env.ASANA_TOKEN?.trim()
  const projectGid = process.env.ASANA_PROJECT_GID?.trim()
  if (!token || !projectGid) return []

  const tasks = await fetchAllProjectTasks(projectGid, token, 'name,html_notes,created_at,tags.name')
  const candidates = tasks.filter((t) => (t.html_notes ?? '').includes('<li>'))

  const entries = await mapWithConcurrency(candidates, 8, async (task) => {
    const subtasks = await fetchSubtasks(task.gid, token)
    return parseBacklogTask(task, subtasks)
  })

  return entries
    .filter((e): e is BacklogEntry => e !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function fetchVersandHistory(): Promise<VersandEntry[]> {
  const token = process.env.ASANA_TOKEN?.trim()
  const projectGid = process.env.ASANA_VERSAND_PROJECT_GID?.trim()
  if (!token || !projectGid) return []

  const tasks = await fetchAllProjectTasks(projectGid, token, 'notes,created_at')
  return tasks
    .map(parseVersandTask)
    .filter((e): e is VersandEntry => e !== null)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
}
