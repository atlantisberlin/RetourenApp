import { isBigQueryConfigured, searchOrders } from '@/lib/bigquery'
import { searchDemoOrders } from '@/lib/demo-data'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''

  if (!q.trim()) {
    return Response.json({ orders: [], query: q, mode: 'demo' })
  }

  if (isBigQueryConfigured()) {
    try {
      const orders = await searchOrders(q)
      return Response.json({ orders, query: q, mode: 'live' })
    } catch (err) {
      console.error('BigQuery search failed:', err)
      return Response.json(
        { error: 'BigQuery-Abfrage fehlgeschlagen', detail: String(err) },
        { status: 500 }
      )
    }
  }

  const orders = searchDemoOrders(q)
  return Response.json({ orders, query: q, mode: 'demo' })
}
