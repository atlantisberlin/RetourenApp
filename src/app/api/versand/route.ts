type Photo = { id: string; dataUrl: string; name: string; type: string }

type VersandBody = {
  carrier: string
  trackingNumber: string
  deliveryNote: string
  insuranceValue: string
  notes: string
  photos: Photo[]
  operatorName: string
}

export async function POST(request: Request) {
  const body: VersandBody = await request.json()

  const asanaToken = process.env.ASANA_TOKEN
  const asanaProject = process.env.ASANA_VERSAND_PROJECT_GID

  if (!asanaToken || !asanaProject) {
    console.log('[demo] Asana Versand nicht konfiguriert — simuliere Einreichung:', body.trackingNumber)
    await new Promise((r) => setTimeout(r, 800))
    return Response.json({ success: true, mode: 'demo', taskId: 'DEMO-VERSAND-' + Date.now() })
  }

  const date = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const carrierPart = body.carrier ? `${body.carrier} – ` : ''
  const title = `Versand – ${carrierPart}${body.trackingNumber} – ${date}`

  const descriptionLines = [
    `Dokumentiert von: ${body.operatorName}`,
    `Datum: ${date}`,
    '',
    body.carrier ? `Logistikunternehmen: ${body.carrier}` : null,
    `Trackingnummer: ${body.trackingNumber}`,
    body.deliveryNote ? `Lieferscheinnummer: ${body.deliveryNote}` : null,
    body.insuranceValue ? `Versicherungssumme: €${body.insuranceValue}` : null,
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
        notes: descriptionLines,
        projects: [asanaProject],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Asana Versand API error:', err)
    return Response.json({ error: 'Asana-Einreichung fehlgeschlagen' }, { status: 502 })
  }

  const data = await res.json()
  const taskGid = data.data?.gid

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
        const fileName = `versand-foto-${i + 1}.jpg`
        formData.append('file', blob, fileName)

        const attachRes = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${asanaToken}` },
          body: formData,
        })
        if (!attachRes.ok) {
          console.error(`Versand-Foto-Upload fehlgeschlagen für ${fileName}:`, await attachRes.text())
        }
      } catch (err) {
        console.error(`Fehler beim Upload von Versand-Foto ${i + 1}:`, err)
      }
    }
  }

  return Response.json({ success: true, mode: 'live', taskId: taskGid })
}
