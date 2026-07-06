/**
 * Komprimiert ein Foto clientseitig (Canvas → JPEG), damit einzelne Uploads
 * klein bleiben. Handy-Fotos mit 5–12MB werden so typischerweise auf
 * 200–500KB reduziert. Bei Fehlern (z. B. nicht dekodierbares Format) wird
 * das Original als DataURL zurückgegeben.
 */
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8

export async function compressImageToDataUrl(file: File): Promise<string> {
  const originalDataUrl = await readFileAsDataUrl(file)
  try {
    const img = await loadImage(originalDataUrl)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
    const width = Math.round(img.width * scale)
    const height = Math.round(img.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return originalDataUrl
    ctx.drawImage(img, 0, 0, width, height)

    const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    // Nur verwenden, wenn wirklich kleiner
    return compressed.length < originalDataUrl.length ? compressed : originalDataUrl
  } catch {
    return originalDataUrl
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => resolve(ev.target?.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    img.src = src
  })
}
