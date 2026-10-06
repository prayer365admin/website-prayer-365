import ContentsChurchEvents from '@/contents/churches/events'

export default async function Page({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params
  return <ContentsChurchEvents churchId={churchId} />
}
