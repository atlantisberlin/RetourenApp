import { getDemoOrder } from '@/lib/demo-data'
import { getOrder, isBigQueryConfigured } from '@/lib/bigquery'
import ErfassenScreen from '@/components/ErfassenScreen'
import { notFound } from 'next/navigation'

export default async function ErfassenPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let order = null
  if (isBigQueryConfigured()) {
    order = await getOrder(id)
  } else {
    order = getDemoOrder(id) ?? null
  }

  if (!order) notFound()

  return <ErfassenScreen order={order} />
}
