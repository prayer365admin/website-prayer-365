import ContentsCentralGeneralPrayerEditor from '@/contents/central/general-prayers/[generalPrayerId]'

export default async function Page({ params }: { params: Promise<{ generalPrayerId: string }> }) {
  const { generalPrayerId } = await params
  return <ContentsCentralGeneralPrayerEditor generalPrayerId={generalPrayerId} />
}
