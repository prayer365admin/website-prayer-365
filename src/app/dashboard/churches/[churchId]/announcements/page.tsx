import ContentsChurchAnnouncements from '@/contents/churches/announcements'

export default async function Page({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params
  return <ContentsChurchAnnouncements churchId={churchId} />
}
