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
      const blob = await dataUrlToBlob(photo.dataUrl)
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

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
