/**
 * Structured audit logging — one JSON line per event via console.log/warn.
 * No logging package (Pino etc.): the hosting platform (Vercel now, Coolify/
 * Docker later, see SELFHOSTING_PLAN.md) already captures stdout/stderr as
 * logs with its own retention settings — that's where "how long to keep
 * these" belongs, not in application code.
 */

type AuditStatus = 'success' | 'failure'

interface AuditEntry {
  event: string
  status: AuditStatus
  operator?: string
  ip?: string
  [key: string]: unknown
}

export function auditLog(entry: AuditEntry): void {
  const line = {
    timestamp: new Date().toISOString(),
    ...entry,
  }
  const log = entry.status === 'failure' ? console.warn : console.log
  log(`[audit] ${JSON.stringify(line)}`)
}
