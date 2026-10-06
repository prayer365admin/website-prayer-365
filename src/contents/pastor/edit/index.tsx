'use client'

import CardTitle from '@/components/common/card-title'
import FormPastor from '@/components/common/form/pastor'
import {
  useAssignPastorToChurch,
  usePastor,
  useUnassignPastorFromChurch,
} from '@/hooks/data/central'
import { PastorFormModel } from '@/models/pastor'
import { Alert, Card } from 'antd'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function ContentsPastorEdit() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, onUpdate } = usePastor(id)
  const { onAssign, loading: assignmentLoading } = useAssignPastorToChurch()
  const { onUnassign, loading: unassignmentLoading } = useUnassignPastorFromChurch()
  const [assignmentWarning, setAssignmentWarning] = useState(
    searchParams.get('assignmentSave') === 'partial'
      ? 'The pastor profile was created, but one or more church assignments failed. Review the selections and save again.'
      : null,
  )

  const handleSubmit = async (payload: PastorFormModel) => {
    const { assignments = [], imageAssetId, imageChurchId, ...profile } = payload
    if (!data) return
    setAssignmentWarning(null)
    const currentChurches = new Set(assignments.map((assignment) => assignment.churchId))
    if (imageAssetId && imageChurchId && !currentChurches.has(imageChurchId)) {
      setAssignmentWarning(
        'The canonical image belongs to a church that is no longer assigned. Keep that church assigned or remove the canonical image before saving.',
      )
      return
    }
    const assignmentResults = await Promise.allSettled([
      ...assignments.map((assignment) =>
        onAssign({
          churchId: assignment.churchId,
          assigned: { ...assignment, pastorId: id },
        }),
      ),
      ...(data.churches ?? [])
        .filter((church) => !currentChurches.has(church.churchId))
        .map((church) => onUnassign({ churchId: church.churchId, pastorId: id })),
    ])
    const failedChanges = assignmentResults.filter(({ status }) => status === 'rejected').length
    if (failedChanges > 0) {
      // The profile update is skipped when relationship changes fail, so the
      // message must not claim the profile was saved.
      setAssignmentWarning(
        `${failedChanges} church assignment change${failedChanges === 1 ? '' : 's'} failed, so the profile changes were not saved. Review the selections and save again.`,
      )
      return
    }
    await onUpdate({ ...profile, imageAssetId, version: data.version })
    router.back()
  }

  const initialValues: PastorFormModel | undefined = data
    ? {
        name: data.name,
        introduction: data.introduction,
        imageAssetId: data.imageAssetId,
        imageChurchId: data.imageChurchId,
        userId: data.user_id,
        assignments: data.churches.map((church) => ({
          churchId: church.churchId,
        })),
      }
    : undefined

  return (
    <Card title={<CardTitle title="Edit Pastor" />}>
      {assignmentWarning && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          closable
          message="Church assignments need attention"
          description={assignmentWarning}
          onClose={() => setAssignmentWarning(null)}
        />
      )}
      {error ? (
        <Alert
          type="error"
          showIcon
          message="Pastor profile could not be loaded"
          description="Return to the pastor list and try again."
        />
      ) : (
        <FormPastor
          onSubmit={handleSubmit}
          initialValues={initialValues}
          loading={loading || assignmentLoading || unassignmentLoading}
          type="UPDATE"
          initialLinkedStaff={data?.user ?? undefined}
        />
      )}
    </Card>
  )
}
