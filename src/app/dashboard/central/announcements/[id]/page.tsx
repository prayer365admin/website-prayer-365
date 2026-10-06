import ContentsCentralAnnouncementDetail from '@/contents/central/announcements/detail'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ContentsCentralAnnouncementDetail id={id} />
}
