import { searchProducts } from '@/lib/bigquery'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''

  if (q.trim().length < 2) {
    return Response.json({ products: [] })
  }

  try {
    const products = await searchProducts(q)
    return Response.json({ products })
  } catch (e) {
    console.error('searchProducts error:', e)
    return Response.json({ products: [], error: String(e) }, { status: 500 })
  }
}
