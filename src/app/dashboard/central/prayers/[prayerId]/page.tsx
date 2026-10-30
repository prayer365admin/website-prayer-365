import ContentsCentralPrayerEditor from '@/contents/central/prayers/editor'

export default async function Page({ params }: { params: Promise<{ prayerId: string }> }) {
  const { prayerId } = await params
  return <ContentsCentralPrayerEditor prayerId={prayerId} />
}
