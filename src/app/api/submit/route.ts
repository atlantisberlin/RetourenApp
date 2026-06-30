import type { ReturnCapture } from '@/lib/types'

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

function escapeHtml(str: string): string {
  return str
    // strip characters invalid in XML 1.0 (control chars except tab/LF/CR)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(request: Request) {
  const body: ReturnCapture = await request.json()

  const asanaToken = process.env.ASANA_TOKEN
  const asanaProject = process.env.ASANA_PROJECT_GID
  const dhlTagGid = process.env.ASANA_DHL_TAG_GID
  const amazonTagGid = process.env.ASANA_AMAZON_TAG_GID ?? '1205680122433653'
  const ebayTagGid = process.env.ASANA_EBAY_TAG_GID ?? '1203021580329302'

  if (!asanaToken || !asanaProject) {
    console.log('[demo] Asana nicht konfiguriert — simuliere Einreichung:', body.orderId)
    await new Promise((r) => setTimeout(r, 800))
    return Response.json({ success: true, mode: 'demo', taskId: 'DEMO-' + Date.now() })
  }

  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  const source = body.order.source ?? 'Atlantis'

  // Retourennummer: aus activeRetourenNr oder Platzhalter zum Nachtragen
  const retourenNr = body.order.activeRetourenNr ?? '___________'

  const title = `Retoure (${retourenNr}) - ${source} - ${date} - ${body.trackingNumber || '-'} - ${body.order.customerName}`

  const returnedItems = body.items.filter((i) => i.returned)

  // ── html_notes ──────────────────────────────────────────────────────────────
  const itemHtml = returnedItems.map((item) => {
    const orderItem = body.order.items.find((i) => i.id === item.itemId)
    const name = escapeHtml(orderItem?.productName ?? item.itemId)
    const cond = escapeHtml(conditionLabel[item.condition] ?? item.condition)
    const reason = escapeHtml(reasonLabel[item.reason] ?? item.reason)
    const resolution = item.resolution === 'erstattung' ? 'Erstattung' : 'Umtausch'
    const notes = item.notes ? ` - <em>${escapeHtml(item.notes)}</em>` : ''
    return `<li><strong>${name}</strong> | ${item.returnedQuantity}x - Zustand: ${cond} - Grund: ${reason} - ${resolution}${notes}</li>`
  }).join('\n')

  // Rechnungsnr: invoiceNr ist die echte Rechnungsnummer, invoiceNumber ist bs_nr (Bestellnr.)
  const rechnungsNr = body.order.invoiceNr

  const metaRows = [
    `<li><strong>Bearbeitet von:</strong> ${escapeHtml(body.operatorName)}</li>`,
    `<li><strong>Bestellnr.:</strong> ${escapeHtml(body.order.orderNumber)}</li>`,
    `<li><strong>Kundennr.:</strong> ${escapeHtml(body.order.customerNumber)}</li>`,
    `<li><strong>Kunde:</strong> ${escapeHtml(body.order.customerName)}</li>`,
    rechnungsNr ? `<li><strong>Rechnungsnr.:</strong> ${escapeHtml(rechnungsNr)}</li>` : null,
    body.order.deliveryNoteNumber ? `<li><strong>Lieferscheinnr.:</strong> ${escapeHtml(body.order.deliveryNoteNumber)}</li>` : null,
    body.order.activeRetourenNr
      ? `<li><strong>Retourennr.:</strong> ${escapeHtml(body.order.activeRetourenNr)}</li>`
      : `<li><strong>Retourennr.:</strong> ___________ <em>(bitte nachtragen)</em></li>`,
    body.trackingNumber ? `<li><strong>Tracking:</strong> ${escapeHtml(body.trackingNumber)}</li>` : null,
  ].filter(Boolean).join('\n')

  const bemerkungHtml = body.notes
    ? `<h2>Bemerkungen</h2><p>${escapeHtml(body.notes)}</p>`
    : ''

  const html_notes = `<body><h2>Auftrag</h2><ul>${metaRows}</ul><h2>Zurückgekommene Positionen</h2><ul>${itemHtml}</ul>${bemerkungHtml}</body>`

  console.log('[Asana] html_notes:', html_notes)

  const res = await fetch('https://app.asana.com/api/1.0/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${asanaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        name: title,
        html_notes,
        projects: [asanaProject],
        tags: [
          ...(body.dhlReturn && dhlTagGid ? [dhlTagGid] : []),
          ...(body.order.partnershop === 'amazon' ? [amazonTagGid] : []),
          ...(body.order.partnershop === 'ebay' ? [ebayTagGid] : []),
        ],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Asana API error:', res.status, err)
    return Response.json({ error: 'Asana-Einreichung fehlgeschlagen', status: res.status, detail: err }, { status: 502 })
  }

  const data = await res.json()
  const taskGid = data.data?.gid

  // Unteraufgaben als Workflow-Checkliste
  if (taskGid) {
    const hasErstattung = returnedItems.some((i) => i.resolution === 'erstattung')
    const hasUmtausch = returnedItems.some((i) => i.resolution === 'umtausch')

    const subtasks: { name: string; completed: boolean }[] = [
      { name: `Paket angenommen – von: ${body.operatorName}`, completed: true },
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
  if (taskGid && body.photos && body.photos.length > 0) {
    for (let i = 0; i < body.photos.length; i++) {
      const photo = body.photos[i]
      try {
        const matches = photo.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
        if (!matches) continue
        const mimeType = matches[1]
        const base64Data = matches[2]
        const buffer = Buffer.from(base64Data, 'base64')

        const formData = new FormData()
        const blob = new Blob([buffer], { type: mimeType })
        formData.append('file', blob, `${photo.type}-${i + 1}.jpg`)

        const attachRes = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${asanaToken}` },
          body: formData,
        })
        if (!attachRes.ok) {
          console.error(`Foto-Upload fehlgeschlagen:`, await attachRes.text())
        }
      } catch (err) {
        console.error(`Fehler beim Upload von Foto ${i + 1}:`, err)
      }
    }
  }

  return Response.json({ success: true, mode: 'live', taskId: taskGid })
}
