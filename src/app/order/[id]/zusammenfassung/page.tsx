import ZusammenfassungScreen from '@/components/ZusammenfassungScreen'

export default async function ZusammenfassungPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ZusammenfassungScreen orderId={id} />
}
