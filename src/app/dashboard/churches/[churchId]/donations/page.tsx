import ContentsChurchDonations from '@/contents/churches/donations'

export default async function Page({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params
  return <ContentsChurchDonations churchId={churchId} />
}
