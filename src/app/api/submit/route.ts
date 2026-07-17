import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'
import { ReturnCaptureSchema } from '@/lib/schemas'
import { auditLog } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { formatRelativeDays } from '@/lib/format'
import { escapeHtmlContent } from '@/lib/asana-format'
import { conditionLabel, reasonLabel } from '@/lib/return-labels'
import { renderReklamationPdf } from '@/lib/reklamation-pdf'
import { z } from 'zod'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const token = extractSessionToken(
      request.headers.get('authorization') ?? undefined,
      request.headers.get('cookie') ?? undefined
    )

    if (!token) {
      auditLog({ event: 'submit', status: 'failure', ip, reason: 'no_token' })
      return apiJson(errorResponse('Unauthorized: No session token'), 401)
    }

    const operatorName = await verifySessionToken(token)
    if (!operatorName) {
      auditLog({ event: 'submit', status: 'failure', ip, reason: 'invalid_token' })
      return apiJson(errorResponse('Unauthorized: Invalid or expired session'), 401)
    }

    const rawBody = await request.json()
    const body = ReturnCaptureSchema.parse(rawBody)

  // trim: Leerzeichen/Zeilenumbrüche aus kopierten Env-Werten lassen Asana
  // sonst mit "Not a Long" abbrechen
  const asanaToken = process.env.ASANA_TOKEN?.trim()
  const asanaProject = process.env.ASANA_PROJECT_GID?.trim()
  const dhlTagGid = process.env.ASANA_DHL_TAG_GID?.trim()
  const amazonTagGid = process.env.ASANA_AMAZON_TAG_GID?.trim() || '1205680122433653'
  const ebayTagGid = process.env.ASANA_EBAY_TAG_GID?.trim() || '1203021580329302'
  const erstattungTagGid = process.env.ASANA_ERSTATTUNG_TAG_GID?.trim() || '1216149276322551'
  const umtauschTagGid = process.env.ASANA_UMTAUSCH_TAG_GID?.trim() || '1208092258165924'

  if (!asanaToken || !asanaProject) {
    console.error('Asana nicht konfiguriert (ASANA_TOKEN/ASANA_PROJECT_GID fehlen)')
    auditLog({ event: 'submit', status: 'failure', ip, reason: 'asana_not_configured' })
    return apiJson(errorResponse('Asana ist nicht konfiguriert'), 503)
  }

  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  const source = body.order.source ?? 'Atlantis'

  const returnedItems = body.items.filter((i) => i.returned)

  // Retourennummer: vom Kunden im Shop selbst angelegt (existingRetoure an den
  // zurückgesendeten Positionen), sonst Platzhalter zum Nachtragen.
  const retourenNr = returnedItems
    .map((i) => body.order.items.find((oi) => oi.id === i.itemId)?.existingRetoure)
    .find((nr): nr is string => !!nr) ?? '___________'
  const hasExistingRetoure = retourenNr !== '___________'

  const title = `Retoure (${retourenNr}) - ${source} - ${date} - ${body.trackingNumber || '-'} - ${body.order.customerName}`

  // ── html_notes: HTML with <body> tag (required by Asana) ────────────────────
  const itemHtml = returnedItems.map((item) => {
    const orderItem = body.order.items.find((i) => i.id === item.itemId)
    const name = escapeHtmlContent(orderItem?.productName ?? item.itemId)
    const cond = escapeHtmlContent(conditionLabel[item.condition] ?? item.condition)
    const reason = escapeHtmlContent(reasonLabel[item.reason] ?? item.reason)
    const resolution = item.resolution === 'erstattung' ? 'Erstattung' : 'Umtausch'
    const notes = item.notes ? ` - ${escapeHtmlContent(item.notes)}` : ''
    const repl = item.replacementProduct
      ? ` - Umtausch gegen: ${escapeHtmlContent(item.replacementProduct.name)}${item.replacementProduct.sku ? ` (${escapeHtmlContent(item.replacementProduct.sku)})` : ''}`
      : ''
    return `<li>${name} | ${item.returnedQuantity}x - Zustand: ${cond} - Grund: ${reason} - ${resolution}${repl}${notes}</li>`
  }).join('')

  const rechnungsNr = body.order.invoiceNr

  const metaRows = [
    `<li>Bearbeitet von: ${escapeHtmlContent(operatorName)}</li>`,
    `<li>Bestellnr.: ${escapeHtmlContent(body.order.orderNumber)}</li>`,
    `<li>Kundennr.: ${escapeHtmlContent(body.order.customerNumber)}</li>`,
    `<li>Kunde: ${escapeHtmlContent(body.order.customerName)}</li>`,
    rechnungsNr ? `<li>Rechnungsnr.: ${escapeHtmlContent(rechnungsNr)}</li>` : null,
    body.order.invoiceDate
      ? `<li>Rechnungsdatum: ${escapeHtmlContent(body.order.invoiceDate)}${
          body.order.invoiceDateDays != null ? ` (${escapeHtmlContent(formatRelativeDays(body.order.invoiceDateDays))})` : ''
        }</li>`
      : null,
    body.order.deliveryNoteNumber ? `<li>Lieferscheinnr.: ${escapeHtmlContent(body.order.deliveryNoteNumber)}</li>` : null,
    hasExistingRetoure
      ? `<li>Retourennr.: ${escapeHtmlContent(retourenNr)}</li>`
      : `<li>Retourennr.: ___________ (bitte nachtragen)</li>`,
    body.trackingNumber ? `<li>Tracking: ${escapeHtmlContent(body.trackingNumber)}</li>` : null,
  ].filter(Boolean).join('')

  const bemerkungHtml = body.notes
    ? `<p>Bemerkungen: ${escapeHtmlContent(body.notes)}</p>`
    : ''

  // Auffälliger, eigenständiger Hinweis oben in der Aufgabe, wenn die
  // Rechnung älter als 14 Tage ist — Asanas html_notes unterstützt kein CSS,
  // daher Fettschrift + Emoji statt Farbe als "auffällig"
  const invoiceWarningHtml = body.order.invoiceDateWarning && body.order.invoiceDate
    ? `<p>⚠️ <strong>Achtung: Rechnung vom ${escapeHtmlContent(body.order.invoiceDate)} (${escapeHtmlContent(formatRelativeDays(body.order.invoiceDateDays ?? 0))}) — älter als 14 Tage!</strong></p>`
    : ''

  const html_notes = `<body>${invoiceWarningHtml}<h2>Auftrag</h2><ul>${metaRows}</ul><h2>Zurückgekommene Positionen</h2><ul>${itemHtml}</ul>${bemerkungHtml}</body>`

  console.log('[Asana] Task name:', title)
  console.log('[Asana] html_notes length:', html_notes.length)
  console.log('[Asana] Tags:', [
    ...(body.dhlReturn && dhlTagGid ? [dhlTagGid] : []),
    ...(body.order.partnershop === 'amazon' ? [amazonTagGid] : []),
    ...(body.order.partnershop === 'ebay' ? [ebayTagGid] : []),
    ...(returnedItems.some(i => i.resolution === 'erstattung') ? [erstattungTagGid] : []),
    ...(returnedItems.some(i => i.resolution === 'umtausch') ? [umtauschTagGid] : []),
  ])

  const tags = [
    ...(body.dhlReturn && dhlTagGid ? [dhlTagGid] : []),
    ...(body.order.partnershop === 'amazon' ? [amazonTagGid] : []),
    ...(body.order.partnershop === 'ebay' ? [ebayTagGid] : []),
    ...(returnedItems.some(i => i.resolution === 'erstattung') ? [erstattungTagGid] : []),
    ...(returnedItems.some(i => i.resolution === 'umtausch') ? [umtauschTagGid] : []),
  ]

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

  let res = await createTask({ data: { name: title, html_notes, projects: [asanaProject], tags } })

  // Fallback: wenn Asana das HTML ablehnt (400), stattdessen als Plain-Text
  // senden, damit die Retoure nie an der Formatierung scheitert
  if (res.status === 400) {
    const err = await res.text()
    console.error('Asana lehnte html_notes ab (400), Fallback auf Plain-Text. Error:', err)
    console.error('html_notes war:', JSON.stringify(html_notes))
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

  // Unteraufgaben als Workflow-Checkliste
  if (taskGid) {
    const hasErstattung = returnedItems.some((i) => i.resolution === 'erstattung')
    const hasUmtausch = returnedItems.some((i) => i.resolution === 'umtausch')

    const subtasks: { name: string; completed: boolean }[] = [
      { name: `Paket angenommen – von: ${operatorName}`, completed: true },
      hasExistingRetoure
        ? { name: `Retoure angelegt (${retourenNr}) – von: ${source}-Kunde`, completed: true }
        : { name: 'Retoure angelegt – von: ___', completed: false },
      ...(hasErstattung ? [{ name: 'Gutschrift geschrieben – von: ___', completed: false }] : []),
      ...(hasUmtausch ? [{ name: 'Umtausch gemacht – von: ___', completed: false }] : []),
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

  // Reklamation: zusätzlicher Task im separaten Reklamations-Projekt mit
  // angehängtem Reklamationsschein-PDF (ersetzt den bisherigen manuellen
  // WordPress-Ablauf). Nicht-fatal — ein Fehler hier darf die eigentliche
  // Retoure nicht blockieren, die Aufgabe oben ist bereits angelegt.
  let reklamationPdfBase64: string | undefined
  const reklamationItems = returnedItems.filter((i) => i.reklamation)
  if (taskGid && reklamationItems.length > 0) {
    try {
      const reklamationProjectGid = process.env.ASANA_REKLAMATION_PROJECT_GID?.trim()
      if (!reklamationProjectGid) {
        console.error('Reklamation nicht angelegt: ASANA_REKLAMATION_PROJECT_GID fehlt')
      } else {
        const pdfItems = reklamationItems.map((item) => {
          const orderItem = body.order.items.find((oi) => oi.id === item.itemId)
          return {
            productName: orderItem?.productName ?? item.itemId,
            sku: orderItem?.sku,
            condition: item.condition,
            reason: item.reason,
          }
        })
        const pdfBuffer = await renderReklamationPdf({
          order: { ...body.order, customerEmail: body.order.customerEmail ?? '' },
          items: pdfItems,
          operatorName,
          notes: body.notes,
        })
        reklamationPdfBase64 = pdfBuffer.toString('base64')

        const reklamationTitle = `Reklamation (${body.order.orderNumber}) - ${body.order.customerName} - ${date}`
        const reklamationNotes = `<body><p>Zugehörige Retoure: <a href="https://app.asana.com/0/0/${taskGid}/f">Task öffnen</a></p></body>`
        const reklaRes = await createTask({ data: { name: reklamationTitle, html_notes: reklamationNotes, projects: [reklamationProjectGid] } })

        if (reklaRes.ok) {
          const reklaData = await reklaRes.json()
          const reklamationTaskGid = reklaData.data?.gid
          if (reklamationTaskGid) {
            const asanaForm = new FormData()
            asanaForm.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), `Reklamation-${body.order.orderNumber}.pdf`)
            const attachRes = await fetch(`https://app.asana.com/api/1.0/tasks/${reklamationTaskGid}/attachments`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${asanaToken}` },
              body: asanaForm,
            })
            if (!attachRes.ok) {
              console.error('Reklamations-PDF-Upload fehlgeschlagen:', await attachRes.text())
            }

            await fetch('https://app.asana.com/api/1.0/tasks', {
              method: 'POST',
              headers: { Authorization: `Bearer ${asanaToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: {
                  name: `Reklamation eingereicht: https://app.asana.com/0/0/${reklamationTaskGid}/f`,
                  completed: false,
                  parent: taskGid,
                },
              }),
            }).catch((err) => console.error('Reklamations-Hinweis-Subtask fehlgeschlagen:', err))
          }
        } else {
          console.error('Reklamations-Task fehlgeschlagen:', await reklaRes.text())
        }
      }
    } catch (err) {
      console.error('Reklamation fehlgeschlagen (non-fatal):', err)
    }
  }

    auditLog({
      event: 'submit',
      status: 'success',
      operator: operatorName,
      ip,
      orderId: body.orderId,
      taskId: taskGid,
      retourenNr: hasExistingRetoure ? retourenNr : null,
      invoiceOverdue: !!body.order.invoiceDateWarning,
    })
    return apiJson(successResponse({ taskId: taskGid, reklamationPdf: reklamationPdfBase64 }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      auditLog({ event: 'submit', status: 'failure', ip, reason: 'invalid_input' })
      return apiJson(
        errorResponse(`Invalid input: ${error.issues[0]?.message || 'Invalid input'}`),
        400
      )
    }
    console.error('Submit error:', error)
    auditLog({ event: 'submit', status: 'failure', ip, reason: 'server_error' })
    return apiJson(errorResponse('Submission failed'), 500)
  }
}
