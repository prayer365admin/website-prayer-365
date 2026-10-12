import ContentsChurchRequestDetail from '@/contents/churches/requests/detail'

export default async function Page({
  params,
}: {
  params: Promise<{ churchId: string; requestId: string }>
}) {
  const { churchId, requestId } = await params
  return <ContentsChurchRequestDetail churchId={churchId} requestId={requestId} />
}
