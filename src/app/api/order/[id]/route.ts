import { isBigQueryConfigured, getOrder } from '@/lib/bigquery'
import { getDemoOrder } from '@/lib/demo-data'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (isBigQueryConfigured()) {
    try {
      const order = await getOrder(id)
      if (!order) return Response.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })
      return Response.json({ order, mode: 'live' })
    } catch (err) {
      console.error('BigQuery order fetch failed:', err)
      return Response.json(
        { error: 'BigQuery-Abfrage fehlgeschlagen', detail: String(err) },
        { status: 500 }
      )
    }
  }

  const order = getDemoOrder(id)
  if (!order) return Response.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })
  return Response.json({ order, mode: 'demo' })
}
