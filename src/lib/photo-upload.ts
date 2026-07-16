import { getSessionToken } from './client-session'

export type UploadablePhoto = { dataUrl: string; name?: string; type?: string }

export type PhotoUploadResult = {
  uploaded: number
  failed: number
  errors: string[]
  // Die Fotos, die fehlgeschlagen sind — damit ein "Erneut versuchen" nur
  // diese nochmal hochlädt statt bereits erfolgreiche zu duplizieren
  failedPhotos: UploadablePhoto[]
}

/**
 * Lädt Fotos einzeln zu einer Asana-Aufgabe hoch (über /api/attach-photo).
 * Jedes Foto ist ein eigener Request und bleibt damit weit unter dem
 * Vercel-Body-Limit von 4,5MB — das vermeidet die früheren 413-Fehler.
 * Fehler bei einzelnen Fotos brechen die übrigen Uploads nicht ab.
 */
export async function uploadPhotosToTask(
  taskGid: string,
  photos: UploadablePhoto[],
  onProgress?: (done: number, total: number) => void
): Promise<PhotoUploadResult> {
  const result: PhotoUploadResult = { uploaded: 0, failed: 0, errors: [], failedPhotos: [] }
  const token = getSessionToken()

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    // Slot-basierte Namen (etikett-1.jpg) wie beim früheren Server-Upload
    const label = photo.type ? `${photo.type}-${i + 1}.jpg` : (photo.name || `foto-${i + 1}.jpg`)
    try {
      const blob = dataUrlToBlob(photo.dataUrl)
      const formData = new FormData()
      formData.append('taskGid', taskGid)
      formData.append('name', label)
      formData.append('file', blob, label)

      const res = await fetch('/api/attach-photo', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })

      if (res.ok) {
        result.uploaded++
      } else {
        const data = await res.json().catch(() => null) as { error?: string } | null
        result.failed++
        result.errors.push(`${label}: ${data?.error ?? `HTTP ${res.status}`}`)
        result.failedPhotos.push(photo)
      }
    } catch (err) {
      result.failed++
      result.errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
      result.failedPhotos.push(photo)
    }
    onProgress?.(i + 1, photos.length)
  }

  return result
}

// Wandelt eine data:-URL direkt in einen Blob um, ohne fetch() zu benutzen.
// fetch(dataUrl) fällt unter die CSP-Regel "connect-src" — die erlaubt nur
// 'self', kein data:. Manche Browser setzen das strikt durch (Fetch schlägt
// mit "Failed to fetch" fehl, ganz ohne Server-Kontakt und ohne Log-Eintrag),
// andere sind da nachsichtiger — daher lief der Upload am Computer, aber
// nicht auf dem Tablet. Reines String-Parsen umgeht das Problem komplett.
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',')
  const header = dataUrl.slice(0, commaIndex)
  const base64 = dataUrl.slice(commaIndex + 1)
  const mimeMatch = header.match(/^data:([^;]+);base64$/)
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}
