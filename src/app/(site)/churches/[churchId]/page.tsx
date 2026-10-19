import ContentsSiteChurchProfile from '@/contents/site/church-profile'

// W08 Church Profile (WB-22). Session guard lives in the (site) layout.
export default async function Page({ params }: { params: Promise<{ churchId: string }> }) {
  const { churchId } = await params
  return <ContentsSiteChurchProfile churchId={churchId} />
}
