import ContentsVoiceReviewDetail from '@/contents/voice/central-review-detail'

export default async function Page({ params }: { params: Promise<{ voiceId: string }> }) {
  const { voiceId } = await params
  return <ContentsVoiceReviewDetail voiceId={voiceId} />
}
