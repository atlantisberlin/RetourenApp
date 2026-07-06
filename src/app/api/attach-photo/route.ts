import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'

// Vercel-Funktionen akzeptieren max. ~4,5MB Request-Body — Fotos werden
// clientseitig komprimiert und einzeln hochgeladen, damit das nie erreicht wird
const MAX_PHOTO_SIZE = 4 * 1024 * 1024 // 4MB

export async function POST(request: Request) {
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

  const formData = await request.formData()
  const taskGid = formData.get('taskGid')
  const file = formData.get('file')
  const name = formData.get('name')

  if (typeof taskGid !== 'string' || !/^\d+$/.test(taskGid)) {
    return apiJson(errorResponse('Ungültige Task-ID'), 400)
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return apiJson(errorResponse('Kein Foto übermittelt'), 400)
  }
  if (file.size > MAX_PHOTO_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2)
    return apiJson(errorResponse(`Foto zu groß: ${sizeMB}MB > 4MB`), 413)
  }

  const asanaToken = process.env.ASANA_TOKEN
  if (!asanaToken) {
    console.log('[demo] Asana nicht konfiguriert — simuliere Foto-Upload für Task', taskGid)
    return apiJson(successResponse({ mode: 'demo' }))
  }

  const fileName = typeof name === 'string' && name ? name : 'foto.jpg'

  const asanaForm = new FormData()
  asanaForm.append('file', file, fileName)

  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${asanaToken}` },
    body: asanaForm,
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`Foto-Upload zu Task ${taskGid} fehlgeschlagen (${res.status}):`, err)
    return apiJson(errorResponse(`Asana Foto-Upload fehlgeschlagen (${res.status})`), 502)
  }

  return apiJson(successResponse({ mode: 'live' }))
}
