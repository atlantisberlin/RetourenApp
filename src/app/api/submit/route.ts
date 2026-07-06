import type { ReturnCapture } from '@/lib/types'
import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'

const conditionLabel: Record<string, string> = {
  gut: 'Gut',
  beschaedigt: 'Beschädigt',
  unvollstaendig: 'Unvollständig',
  defekt: 'Defekt',
}

const reasonLabel: Record<string, string> = {
  gefaellt_nicht: 'Gefällt nicht',
  falsch_geliefert: 'Falsch geliefert',
  defekt_bei_ankunft: 'Defekt bei Ankunft',
  groesse_passt_nicht: 'Größe passt nicht',
  beschaedigt_bei_lieferung: 'Beschädigt bei Lieferung',
  sonstiges: 'Sonstiges',
}

const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10MB

function escapeHtmlContent(str: string): string {
  return str
    // strip characters that Asana's XML parser rejects: C0 controls (except
    // tab/LF/CR, e.g. GS1 barcode separators from scanners), DEL, C1 controls,
    // unpaired surrogates and non-characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: Request) {
  // ──────────────────────────────────────────────────────────────
  // 1. VERIFY SESSION TOKEN (NEW: JWT-based security)
  // ──────────────────────────────────────────────────────────────
  const token = extractSessionToken(
    request.headers.get('authorization') ?? undefined,
    request.headers.get('cookie') ?? undefined
  )

  if (!token) {
    return apiJson(errorResponse('Unauthorized: No session token'), 401)
  }

  const operatorName = await verifySessionToken(token)
  if (!operatorName) {
    return apiJson(errorResponse('Unauthorized: Invalid or expired session'), 401)
  }

  const body: ReturnCapture = await request.json()

  const asanaToken = process.env.ASANA_TOKEN
  const asanaProject = process.env.ASANA_PROJECT_GID
  const dhlTagGid = process.env.ASANA_DHL_TAG_GID
  const amazonTagGid = process.env.ASANA_AMAZON_TAG_GID ?? '1205680122433653'
  const ebayTagGid = process.env.ASANA_EBAY_TAG_GID ?? '1203021580329302'
  const erstattungTagGid = process.env.ASANA_ERSTATTUNG_TAG_GID ?? '1216149276322551'
  const umtauschTagGid = process.env.ASANA_UMTAUSCH_TAG_GID ?? '1208092258165924'

  if (!asanaToken || !asanaProject) {
    console.log('[demo] Asana nicht konfiguriert — simuliere Einreichung:', body.orderId)
    await new Promise((r) => setTimeout(r, 800))
    return apiJson(successResponse({ mode: 'demo', taskId: 'DEMO-' + Date.now() }))
  }

  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  const source = body.order.source ?? 'Atlantis'

  // Retourennummer: aus activeRetourenNr oder Platzhalter zum Nachtragen
  const retourenNr = body.order.activeRetourenNr ?? '___________'

  const title = `Retoure (${retourenNr}) - ${source} - ${date} - ${body.trackingNumber || '-'} - ${body.order.customerName}`

  const returnedItems = body.items.filter((i) => i.returned)

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
    body.order.deliveryNoteNumber ? `<li>Lieferscheinnr.: ${escapeHtmlContent(body.order.deliveryNoteNumber)}</li>` : null,
    body.order.activeRetourenNr
      ? `<li>Retourennr.: ${escapeHtmlContent(body.order.activeRetourenNr)}</li>`
      : `<li>Retourennr.: ___________ (bitte nachtragen)</li>`,
    body.trackingNumber ? `<li>Tracking: ${escapeHtmlContent(body.trackingNumber)}</li>` : null,
  ].filter(Boolean).join('')

  const bemerkungHtml = body.notes
    ? `<p>Bemerkungen: ${escapeHtmlContent(body.notes)}</p>`
    : ''

  const html_notes = `<body><h2>Auftrag</h2><ul>${metaRows}</ul><h2>Zurückgekommene Positionen</h2><ul>${itemHtml}</ul>${bemerkungHtml}</body>`

  console.log('[Asana] Task name:', title)
  console.log('[Asana] Photos count:', body.photos?.length ?? 0)
  console.log('[Asana] html_notes length:', html_notes.length)
  console.log('[Asana] Photos included in payload:', !!body.photos)
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
      body.order.activeRetourenNr
        ? { name: `Retoure angelegt (${body.order.activeRetourenNr}) – von: ATLOS-Kunde`, completed: true }
        : { name: 'Retoure angelegt – von: ___', completed: false },
      ...(hasErstattung ? [{ name: 'Gutschrift geschrieben – von: ___', completed: false }] : []),
      ...(hasUmtausch ? [{ name: 'Umtausch gemacht – von: ___', completed: false }] : []),
    ]

    for (const subtask of subtasks) {
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
    }
  }

  // Fotos als Anhänge hochladen
  const photoErrors: string[] = []
  if (taskGid && body.photos && body.photos.length > 0) {
    for (let i = 0; i < body.photos.length; i++) {
      const photo = body.photos[i]
      try {
        const matches = photo.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
        if (!matches) {
          photoErrors.push(`Foto ${i + 1}: Ungültiges Datenformat`)
          continue
        }
        const mimeType = matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, 'base64')

        // Check file size limit (10MB)
        if (buffer.length > MAX_PHOTO_SIZE) {
          const sizeMB = (buffer.length / 1024 / 1024).toFixed(2)
          photoErrors.push(`Foto ${i + 1}: ${sizeMB}MB > 10MB Limit`)
          continue
        }

        const formData = new FormData()
        const blob = new Blob([buffer], { type: mimeType })
        formData.append('file', blob, `${photo.type}-${i + 1}.jpg`)

        const attachRes = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${asanaToken}` },
          body: formData,
        })
        if (!attachRes.ok) {
          const err = await attachRes.text()
          console.error(`Foto-Upload ${i + 1} fehlgeschlagen (${attachRes.status}):`, err)
          photoErrors.push(`Foto ${i + 1}: Asana API Fehler ${attachRes.status}`)
        } else {
          console.log(`Foto ${i + 1} erfolgreich hochgeladen`)
        }
      } catch (err) {
        console.error(`Fehler beim Upload von Foto ${i + 1}:`, err)
        photoErrors.push(`Foto ${i + 1}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  if (photoErrors.length > 0) {
    console.warn('Photo upload errors:', photoErrors)
  }

  return apiJson(successResponse({ mode: 'live', taskId: taskGid }))
}
