import { timingSafeEqual } from 'crypto'
import { createDeviceToken, getDeviceCookieHeader } from '@/lib/device-auth'
import { apiJson, successResponse, errorResponse } from '@/lib/api-response'
import { DeviceCodeSchema } from '@/lib/schemas'
import { auditLog } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

// Nur für lokale Entwicklung ohne gesetzten DEVICE_ACCESS_CODE
const DEV_FALLBACK_CODE = 'atlantis-dev'

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Vergleich mit sich selbst, damit die Antwortzeit bei unterschiedlicher
    // Länge nicht verrät, dass der Code schon an der Länge scheitert
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const rawBody = await request.json()
    const { code } = DeviceCodeSchema.parse(rawBody)

    const expected = process.env.DEVICE_ACCESS_CODE?.trim()
    if (!expected) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[device-auth] DEVICE_ACCESS_CODE ist in Produktion nicht gesetzt')
        return apiJson(errorResponse('Geräte-Login nicht konfiguriert'), 500)
      }
      console.warn('[device-auth] DEVICE_ACCESS_CODE nicht gesetzt — nutze Dev-Fallback-Code')
    }

    const isValid = safeCompare(code.trim(), expected ?? DEV_FALLBACK_CODE)
    if (!isValid) {
      auditLog({ event: 'device_unlock', status: 'failure', ip })
      return apiJson(errorResponse('Ungültiger Zugangscode'), 401)
    }

    auditLog({ event: 'device_unlock', status: 'success', ip })

    const token = await createDeviceToken()
    return new Response(JSON.stringify(successResponse({ ok: true })), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': getDeviceCookieHeader(token),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiJson(
        errorResponse(`Ungültige Eingabe: ${error.issues[0]?.message || 'Invalid input'}`),
        400
      )
    }
    console.error('Device auth error:', error)
    auditLog({ event: 'device_unlock', status: 'failure', ip, reason: 'server_error' })
    return apiJson(errorResponse('Geräte-Anmeldung fehlgeschlagen'), 500)
  }
}
