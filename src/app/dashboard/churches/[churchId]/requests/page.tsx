import ContentsChurchRequests from '@/contents/churches/requests'

export default async function Page({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params
  return <ContentsChurchRequests churchId={churchId} />
}
