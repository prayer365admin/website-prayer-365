'use client'

import CardTitle from '@/components/common/card-title'
import FormPastor from '@/components/common/form/pastor'
import { useAssignPastorToChurch, usePastors } from '@/hooks/data/central'
import { PastorFormModel } from '@/models/pastor'
import { Card } from 'antd'
import { useRouter } from 'next/navigation'

export default function ContentsPastorCreate() {
  const router = useRouter()
  const { onCreate, onUpdate, loading } = usePastors({ enableFetch: false })
  const { onAssign, loading: assignmentLoading } = useAssignPastorToChurch()

  const handleSubmit = async (payload: PastorFormModel) => {
    const { assignments = [], imageAssetId, imageChurchId: _imageChurchId, ...profile } = payload
    const response = await onCreate(profile)
    const pastorId = response.data.result.id as string
    const assignmentResults = await Promise.allSettled(
      assignments.map((assignment) =>
        onAssign({
          churchId: assignment.churchId,
          assigned: { ...assignment, pastorId },
        }),
      ),
    )
    if (assignmentResults.some(({ status }) => status === 'rejected')) {
      router.replace(`/dashboard/central/pastors/${pastorId}?assignmentSave=partial`)
      return
    }
    if (imageAssetId) {
      await onUpdate({ pastorId, payload: { version: 1, imageAssetId } })
    }
    router.back()
  }

  return (
    <Card title={<CardTitle title="Create Pastor" />}>
      <FormPastor onSubmit={handleSubmit} loading={loading || assignmentLoading} />
    </Card>
  )
}
