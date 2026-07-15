import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'
import { VersandSchema } from '@/lib/schemas'
import { auditLog } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const token = extractSessionToken(
      request.headers.get('authorization') ?? undefined,
      request.headers.get('cookie') ?? undefined
    )

    if (!token) {
      auditLog({ event: 'versand', status: 'failure', ip, reason: 'no_token' })
      return apiJson(errorResponse('Unauthorized: No session token'), 401)
    }

    const operatorName = await verifySessionToken(token)
    if (!operatorName) {
      auditLog({ event: 'versand', status: 'failure', ip, reason: 'invalid_token' })
      return apiJson(errorResponse('Unauthorized: Invalid or expired session'), 401)
    }

    const rawBody = await request.json()
    const body = VersandSchema.parse(rawBody)

  // trim: Leerzeichen/Zeilenumbrüche aus kopierten Env-Werten lassen Asana
  // sonst mit "Not a Long" abbrechen
  const asanaToken = process.env.ASANA_TOKEN?.trim()
  const asanaProject = process.env.ASANA_VERSAND_PROJECT_GID?.trim()

  if (!asanaToken || !asanaProject) {
    console.error('Asana Versand nicht konfiguriert (ASANA_TOKEN/ASANA_VERSAND_PROJECT_GID fehlen)')
    auditLog({ event: 'versand', status: 'failure', ip, reason: 'asana_not_configured' })
    return apiJson(errorResponse('Asana ist nicht konfiguriert'), 503)
  }

  const date = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const carrierPart = body.carrier ? `${body.carrier} – ` : ''
  const title = `Versand – ${carrierPart}${body.trackingNumber} – ${date}`

  const descriptionLines = [
    `Dokumentiert von: ${operatorName}`,
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
    return apiJson(errorResponse('Asana submission failed'), 502)
  }

  const data = await res.json()
  const taskGid = data.data?.gid

    auditLog({ event: 'versand', status: 'success', operator: operatorName, ip, trackingNumber: body.trackingNumber, taskId: taskGid })
    return apiJson(successResponse({ taskId: taskGid }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      auditLog({ event: 'versand', status: 'failure', ip, reason: 'invalid_input' })
      return apiJson(
        errorResponse(`Invalid input: ${error.issues[0]?.message || 'Invalid input'}`),
        400
      )
    }
    console.error('Versand error:', error)
    auditLog({ event: 'versand', status: 'failure', ip, reason: 'server_error' })
    return apiJson(errorResponse('Submission failed'), 500)
  }
}
