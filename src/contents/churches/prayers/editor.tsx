'use client'

import Tabs from '@/components/common/tabs'
import { useChurchProfile } from '@/hooks/data/church'
import { useChurchPastors } from '@/hooks/data/pastor'
import { useApproveText, useCreatePrayer, usePatchPrayer, usePrayer } from '@/hooks/data/prayer'
import { PrayerInput, PrayerOutput } from '@/models/prayer'
import { Form } from 'antd'
import { useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import styles from './editor.module.scss'
import PrayerAudioPublicationTab from './editor/audio-publication-tab'
import PrayerEditorHeader from './editor/header'
import PrayerEditorLoadingState from './editor/loading-state'
import PrayerReviewDrawer from './editor/review-drawer'
import PrayerTextTab from './editor/text-tab'
import { PrayerFeaturedAsset } from './editor/types'

type PrayerEditorProps = {
  churchId: string
  prayerId?: string
  churchContext?: ReactNode
  createdPrayerPath?: (prayerId: string) => string
  formDisabled?: boolean
}

export default function ContentsChurchesPrayersEditor({
  churchId,
  prayerId,
  churchContext,
  createdPrayerPath,
  formDisabled = false,
}: PrayerEditorProps) {
  const router = useRouter()
  const isEdit = !!prayerId
  const [form] = Form.useForm<PrayerInput>()
  const [saved, setSaved] = useState<PrayerOutput | null>(null)
  const [featuredAsset, setFeaturedAsset] = useState<PrayerFeaturedAsset>({
    assetId: null,
    url: null,
  })
  const [reviewOpen, setReviewOpen] = useState(false)

  const { data: prayer } = usePrayer(churchId, prayerId ?? '')
  const { data: profile } = useChurchProfile(churchId)
  const { data: pastors } = useChurchPastors(churchId)
  const { onCreate, loading: createLoading } = useCreatePrayer(churchId)
  const { onPatch, loading: patchLoading } = usePatchPrayer(churchId, prayerId ?? '')
  const { onApproveText, loading: approveLoading } = useApproveText(churchId, prayerId ?? '')

  useEffect(() => {
    if (!prayer) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved((previous) => (!previous || prayer.version > previous.version ? prayer : previous))
    setFeaturedAsset((current) =>
      current.assetId === prayer.featuredAssetId
        ? current
        : {
            assetId: prayer.featuredAssetId ?? null,
            url: prayer.featuredAssetId
              ? `/api/v1/uploads/${prayer.featuredAssetId}/access?churchId=${encodeURIComponent(churchId)}`
              : null,
          },
    )
  }, [churchId, prayer])

  const handleSubmit = async (payload: PrayerInput) => {
    if (!churchId) return
    const input = { ...payload, featuredAssetId: featuredAsset.assetId }

    if (isEdit && saved) {
      const result = await onPatch({ ...input, version: saved.version })
      setSaved(result)
      return
    }

    const result = await onCreate(input)
    router.replace(
      createdPrayerPath?.(result.id) ?? `/dashboard/churches/${churchId}/prayers/${result.id}`,
    )
  }

  const handleApprove = async () => {
    if (!saved?.current) return
    const result = await onApproveText({
      version: saved.version,
      prayerVersionId: saved.current.id,
    })
    setSaved((previous) => (previous ? { ...previous, textApproved: true, current: result } : null))
    setReviewOpen(false)
  }

  if (isEdit && !saved) {
    return <PrayerEditorLoadingState onBack={() => router.back()} />
  }

  const tabItems = [
    {
      key: 'text',
      label: 'Text',
      children: (
        <PrayerTextTab
          churchContext={churchContext}
          churchId={churchId}
          featuredAsset={featuredAsset}
          form={form}
          formDisabled={formDisabled}
          onSubmit={handleSubmit}
          profile={profile}
          saveLoading={createLoading || patchLoading}
          saved={saved}
          setFeaturedAsset={setFeaturedAsset}
        />
      ),
    },
    {
      key: 'audio',
      label: 'Audio & Publication',
      children: (
        <PrayerAudioPublicationTab
          churchId={churchId}
          onOpenReview={() => setReviewOpen(true)}
          pastors={pastors}
          prayerId={prayerId ?? ''}
          profile={profile}
          saved={saved}
        />
      ),
    },
  ]

  return (
    <section className={styles.page}>
      <PrayerEditorHeader
        onBack={() => router.back()}
        title={saved?.current?.title ?? 'New Prayer'}
      />
      <Tabs items={tabItems} padding="0 16px 16px" />
      <PrayerReviewDrawer
        approveLoading={approveLoading}
        onApprove={handleApprove}
        onClose={() => setReviewOpen(false)}
        open={reviewOpen}
        pastors={pastors}
        saved={saved}
      />
    </section>
  )
}
