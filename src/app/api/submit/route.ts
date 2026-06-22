import type { ReturnCapture } from '@/lib/types'

export async function POST(request: Request) {
  const body: ReturnCapture = await request.json()

  const asanaToken = process.env.ASANA_TOKEN
  const asanaProject = process.env.ASANA_PROJECT_GID

  if (!asanaToken || !asanaProject) {
    console.log('[demo] Asana nicht konfiguriert — simuliere Einreichung:', body.orderId)
    await new Promise((r) => setTimeout(r, 800))
    return Response.json({ success: true, mode: 'demo', taskId: 'DEMO-' + Date.now() })
  }

  const date = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const title = `Retoure – ${body.order.source ?? 'Atlantis'} – ${date} – ${body.order.orderNumber} – ${body.order.customerName}`

  const returnedItems = body.items.filter((i) => i.returned)
  const itemLines = returnedItems.map((item) => {
    const orderItem = body.order.items.find((i) => i.id === item.itemId)
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
    return `• ${orderItem?.productName ?? item.itemId}: ${item.returnedQuantity}× — Zustand: ${conditionLabel[item.condition]} — Grund: ${reasonLabel[item.reason]} — ${item.resolution === 'erstattung' ? 'Erstattung' : 'Umtausch'}${item.notes ? ` (${item.notes})` : ''}`
  })

  const description = [
    `Bearbeitet von: ${body.operatorName}`,
    `Bestellnr.: ${body.order.orderNumber}`,
    `Kundennr.: ${body.order.customerNumber}`,
    `Kunde: ${body.order.customerName}`,
    body.order.invoiceNumber ? `Rechnungsnr.: ${body.order.invoiceNumber}` : null,
    body.packageService ? `Paketdienst: ${body.packageService}` : null,
    body.trackingNumber ? `Tracking: ${body.trackingNumber}` : null,
    '',
    'Zurückgekommene Positionen:',
    ...itemLines,
    body.notes ? `\nBemerkungen: ${body.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const res = await fetch('https://app.asana.com/api/1.0/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${asanaToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        name: title,
        notes: description,
        projects: [asanaProject],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Asana API error:', err)
    return Response.json({ error: 'Asana-Einreichung fehlgeschlagen' }, { status: 502 })
  }

  const data = await res.json()
  return Response.json({ success: true, mode: 'live', taskId: data.data?.gid })
}
