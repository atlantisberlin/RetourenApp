import FotosScreen from '@/components/FotosScreen'

export default async function FotosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <FotosScreen orderId={id} />
}
