import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'
import { UndeliveredCaptureSchema } from '@/lib/schemas'
import { auditLog } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { escapeHtmlContent } from '@/lib/asana-format'
import { z } from 'zod'

const reasonLabel: Record<string, string> = {
  annahme_verweigert: 'Annahme verweigert',
  nicht_abgeholt: 'Nicht abgeholt',
  empfaenger_unbekannt: 'Empfänger unbekannt/verzogen',
  sonstiges: 'Sonstiges',
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const token = extractSessionToken(
      request.headers.get('authorization') ?? undefined,
      request.headers.get('cookie') ?? undefined
    )

    if (!token) {
      auditLog({ event: 'submit_undelivered', status: 'failure', ip, reason: 'no_token' })
      return apiJson(errorResponse('Unauthorized: No session token'), 401)
    }

    const operatorName = await verifySessionToken(token)
    if (!operatorName) {
      auditLog({ event: 'submit_undelivered', status: 'failure', ip, reason: 'invalid_token' })
      return apiJson(errorResponse('Unauthorized: Invalid or expired session'), 401)
    }

    const rawBody = await request.json()
    const body = UndeliveredCaptureSchema.parse(rawBody)

    // trim: Leerzeichen/Zeilenumbrüche aus kopierten Env-Werten lassen Asana
    // sonst mit "Not a Long" abbrechen
    const asanaToken = process.env.ASANA_TOKEN?.trim()
    const asanaProject = process.env.ASANA_PROJECT_GID?.trim()
    // Optional: eigener Abschnitt im Projekt "Retoureneingang", damit
    // unzustellbare Sendungen nicht zwischen normalen Retouren stehen
    const sectionGid = process.env.ASANA_UNZUSTELLBAR_SECTION_GID?.trim()
    // Tag "DHL-Unzustellbar angeschrieben"
    const tagGid = process.env.ASANA_UNZUSTELLBAR_TAG_GID?.trim() || '1202829056220026'

    if (!asanaToken || !asanaProject) {
      console.error('Asana nicht konfiguriert (ASANA_TOKEN/ASANA_PROJECT_GID fehlen)')
      auditLog({ event: 'submit_undelivered', status: 'failure', ip, reason: 'asana_not_configured' })
      return apiJson(errorResponse('Asana ist nicht konfiguriert'), 503)
    }

    const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    const source = body.order.source ?? 'Atlantis'
    const reasonText = reasonLabel[body.reason] ?? body.reason

    const title = `Nicht zugestellt (${reasonText}) - ${source} - ${date} - ${body.order.customerName}`

    const metaRows = [
      `<li>Bearbeitet von: ${escapeHtmlContent(operatorName)}</li>`,
      `<li>Bestellnr.: ${escapeHtmlContent(body.order.orderNumber)}</li>`,
      `<li>Kundennr.: ${escapeHtmlContent(body.order.customerNumber)}</li>`,
      `<li>Kunde: ${escapeHtmlContent(body.order.customerName)}</li>`,
      body.order.deliveryNoteNumber ? `<li>Lieferscheinnr.: ${escapeHtmlContent(body.order.deliveryNoteNumber)}</li>` : null,
      `<li>Grund: ${escapeHtmlContent(reasonText)}</li>`,
    ].filter(Boolean).join('')

    const bemerkungHtml = body.notes ? `<p>Bemerkungen: ${escapeHtmlContent(body.notes)}</p>` : ''

    const html_notes = `<body><p>📦 <strong>Paket kam unzustellbar zurück — wurde nicht geöffnet.</strong></p><h2>Auftrag</h2><ul>${metaRows}</ul>${bemerkungHtml}</body>`

    async function createTask(payload: object): Promise<Response> {
      return fetch('https://app.asana.com/api/1.0/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${asanaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    }

    const tags = tagGid ? [tagGid] : []

    let res = await createTask({ data: { name: title, html_notes, projects: [asanaProject], tags } })

    // Fallback: wenn Asana das HTML ablehnt (400), stattdessen als Plain-Text
    // senden, damit die Erfassung nie an der Formatierung scheitert
    if (res.status === 400) {
      const err = await res.text()
      console.error('Asana lehnte html_notes ab (400), Fallback auf Plain-Text. Error:', err)
      const plainNotes = html_notes
        .replace(/<\/(h2|li|p)>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      res = await createTask({ data: { name: title, notes: plainNotes, projects: [asanaProject], tags } })
    }

    if (!res.ok) {
      const err = await res.text()
      console.error('Asana API error:', res.status)
      console.error('Asana error body:', err)
      return apiJson(errorResponse('Asana submission failed'), 502)
    }

    const data = await res.json()
    const taskGid = data.data?.gid

    if (taskGid) {
      // In den separaten Abschnitt verschieben (Task ist bereits Mitglied des
      // Projekts durch "projects" oben — addTask platziert sie dort um)
      if (sectionGid) {
        try {
          const sectionRes = await fetch(`https://app.asana.com/api/1.0/sections/${sectionGid}/addTask`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${asanaToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { task: taskGid } }),
          })
          if (!sectionRes.ok) {
            console.error('Verschieben in Abschnitt fehlgeschlagen:', await sectionRes.text())
          }
        } catch (err) {
          console.error('Fehler beim Verschieben in Abschnitt:', err)
        }
      }

      const subtasks: { name: string; completed: boolean }[] = [
        { name: `Paket angenommen (nicht zugestellt) – von: ${operatorName}`, completed: true },
        { name: 'Kunde angeschrieben – von: ___', completed: false },
        { name: 'Rückmeldung vom Kunden erhalten – von: ___', completed: false },
      ]

      // Unteraufgaben sind unabhängig voneinander — parallel anlegen statt nacheinander
      await Promise.all(subtasks.map(async (subtask) => {
        try {
          const subRes = await fetch('https://app.asana.com/api/1.0/tasks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${asanaToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { name: subtask.name, completed: subtask.completed, parent: taskGid } }),
          })
          if (!subRes.ok) {
            console.error('Unteraufgabe fehlgeschlagen:', await subRes.text())
          }
        } catch (err) {
          console.error('Fehler beim Anlegen der Unteraufgabe:', err)
        }
      }))
    }

    auditLog({
      event: 'submit_undelivered',
      status: 'success',
      operator: operatorName,
      ip,
      orderId: body.orderId,
      taskId: taskGid,
      reason: body.reason,
    })
    return apiJson(successResponse({ taskId: taskGid }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      auditLog({ event: 'submit_undelivered', status: 'failure', ip, reason: 'invalid_input' })
      return apiJson(
        errorResponse(`Invalid input: ${error.issues[0]?.message || 'Invalid input'}`),
        400
      )
    }
    console.error('Submit undelivered error:', error)
    auditLog({ event: 'submit_undelivered', status: 'failure', ip, reason: 'server_error' })
    return apiJson(errorResponse('Submission failed'), 500)
  }
}
