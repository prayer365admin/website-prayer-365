import ContentsCentralChurchSetup from '@/contents/central/churches/setup'

export default async function Page({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params
  return <ContentsCentralChurchSetup churchId={churchId} />
}
