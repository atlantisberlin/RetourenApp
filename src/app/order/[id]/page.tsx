import { getDemoOrder } from '@/lib/demo-data'
import { getOrder, isBigQueryConfigured } from '@/lib/bigquery'
import OrderDetailScreen from '@/components/OrderDetailScreen'
import { notFound } from 'next/navigation'

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let order = null
  let mode: 'live' | 'demo' = 'demo'

  if (isBigQueryConfigured()) {
    order = await getOrder(id)
    mode = 'live'
  } else {
    order = getDemoOrder(id) ?? null
  }

  if (!order) notFound()

  return <OrderDetailScreen order={order} mode={mode} />
}
