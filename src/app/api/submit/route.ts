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

  // ── html_notes as plain text to avoid XML parsing errors ──────────────────
  const itemLines = returnedItems.map((item) => {
    const orderItem = body.order.items.find((i) => i.id === item.itemId)
    const name = orderItem?.productName ?? item.itemId
    const cond = conditionLabel[item.condition] ?? item.condition
    const reason = reasonLabel[item.reason] ?? item.reason
    const resolution = item.resolution === 'erstattung' ? 'Erstattung' : 'Umtausch'
    const notes = item.notes ? ` - ${item.notes}` : ''
    const repl = item.replacementProduct
      ? ` - Umtausch gegen: ${item.replacementProduct.name}${item.replacementProduct.sku ? ` (${item.replacementProduct.sku})` : ''}`
      : ''
    return `• ${name} | ${item.returnedQuantity}x - Zustand: ${cond} - Grund: ${reason} - ${resolution}${repl}${notes}`
  }).join('\n')

  // Rechnungsnr: invoiceNr ist die echte Rechnungsnummer, invoiceNumber ist bs_nr (Bestellnr.)
  const rechnungsNr = body.order.invoiceNr

  const metaLines = [
    `Bearbeitet von: ${operatorName}`,
    `Bestellnr.: ${body.order.orderNumber}`,
    `Kundennr.: ${body.order.customerNumber}`,
    `Kunde: ${body.order.customerName}`,
    rechnungsNr ? `Rechnungsnr.: ${rechnungsNr}` : null,
    body.order.deliveryNoteNumber ? `Lieferscheinnr.: ${body.order.deliveryNoteNumber}` : null,
    body.order.activeRetourenNr
      ? `Retourennr.: ${body.order.activeRetourenNr}`
      : `Retourennr.: ___________ (bitte nachtragen)`,
    body.trackingNumber ? `Tracking: ${body.trackingNumber}` : null,
  ].filter(Boolean).join('\n')

  const bemerkungText = body.notes
    ? `\n\nBemerkungen:\n${body.notes}`
    : ''

  const html_notes = `AUFTRAG\n${metaLines}\n\nZURÜCKGEKOMMENE POSITIONEN\n${itemLines}${bemerkungText}`

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

  const taskPayload = {
    data: {
      name: title,
      html_notes,
      projects: [asanaProject],
      tags: [
        ...(body.dhlReturn && dhlTagGid ? [dhlTagGid] : []),
        ...(body.order.partnershop === 'amazon' ? [amazonTagGid] : []),
        ...(body.order.partnershop === 'ebay' ? [ebayTagGid] : []),
        ...(returnedItems.some(i => i.resolution === 'erstattung') ? [erstattungTagGid] : []),
        ...(returnedItems.some(i => i.resolution === 'umtausch') ? [umtauschTagGid] : []),
      ],
    },
  }

  const res = await fetch('https://app.asana.com/api/1.0/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${asanaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskPayload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Asana API error:', res.status)
    console.error('Asana error body:', err)
    console.error('Task payload size:', JSON.stringify(taskPayload).length, 'bytes')
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
