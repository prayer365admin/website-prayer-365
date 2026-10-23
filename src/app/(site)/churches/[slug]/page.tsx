import ContentsSiteChurchProfile from '@/contents/site/church-profile'

// W08 Church Profile (WB-22). Session guard lives in the (site) layout.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ContentsSiteChurchProfile slug={slug} />
}
