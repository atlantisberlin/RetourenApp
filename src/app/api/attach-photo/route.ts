import { verifySessionToken, extractSessionToken } from '@/lib/session'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'

// Vercel-Funktionen akzeptieren max. ~4,5MB Request-Body — Fotos werden
// clientseitig komprimiert und einzeln hochgeladen, damit das nie erreicht wird
const MAX_PHOTO_SIZE = 4 * 1024 * 1024 // 4MB

// Magic-Byte-Prüfung statt dem angegebenen Content-Type zu vertrauen — sonst
// könnte über dieses Formular jede Datei als "Foto" an Asana angehängt werden
async function isValidImage(file: Blob): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return true // JPEG
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return true // PNG
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) return true // GIF
  if (
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) return true // WebP
  return false
}

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
  if (!(await isValidImage(file))) {
    return apiJson(errorResponse('Datei ist kein gültiges Bild'), 400)
  }

  const asanaToken = process.env.ASANA_TOKEN?.trim()
  if (!asanaToken) {
    console.error('Asana nicht konfiguriert (ASANA_TOKEN fehlt)')
    return apiJson(errorResponse('Asana ist nicht konfiguriert'), 503)
  }

  // taskGid kommt vom Client — sicherstellen, dass die Aufgabe wirklich zu
  // einem unserer eigenen Projekte gehört, bevor wir eine Datei anhängen.
  // Sonst könnte jeder gültige Bearer-Token Dateien an beliebige Asana-
  // Aufgaben im gesamten Workspace anhängen.
  const allowedProjects = [
    process.env.ASANA_PROJECT_GID?.trim(),
    process.env.ASANA_VERSAND_PROJECT_GID?.trim(),
  ].filter((gid): gid is string => !!gid)

  const taskRes = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=projects.gid`, {
    headers: { Authorization: `Bearer ${asanaToken}` },
  })
  if (!taskRes.ok) {
    return apiJson(errorResponse('Task nicht gefunden'), 404)
  }
  const taskData = await taskRes.json()
  const taskProjectGids: string[] = (taskData.data?.projects ?? []).map((p: { gid: string }) => p.gid)
  if (!taskProjectGids.some((gid) => allowedProjects.includes(gid))) {
    return apiJson(errorResponse('Task gehört zu keinem erlaubten Projekt'), 403)
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

  return apiJson(successResponse({}))
}
