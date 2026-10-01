'use client'

import { useChurchProfile, useChurchServiceTimes } from '@/hooks/data/church'
import { ChurchProfileInput, ChurchProfileOutput } from '@/models/church'
import { ServiceTimeScheduleInput } from '@/models/service-time'
import { Card, Skeleton, Typography } from 'antd'
import { useParams } from 'next/navigation'
import { Fragment } from 'react'
import FormChurchProfileTabs from '@/components/common/form/church-profile'

export default function ContentsChurchProfile() {
  const { churchId } = useParams<{ churchId: string }>()
  const { data, loading, onUpdate } = useChurchProfile(churchId)
  const { data: serviceTimes, onReplace } = useChurchServiceTimes(churchId)

  const handleSubmit = async (payload: ChurchProfileInput) => {
    const res = await onUpdate(payload)
    return res?.data?.result as ChurchProfileOutput
  }

  const handleReplace = async (p: ServiceTimeScheduleInput) => {
    try {
      await onReplace(p)
    } catch (_e) {
      // Error notification handled by useChurchServiceTimes
    }
  }

  return (
    <Fragment>
      <Typography.Title level={2}>Church profile</Typography.Title>
      <Card>
        {data && serviceTimes ? (
          <FormChurchProfileTabs
            initialValues={data}
            serviceTimes={serviceTimes ?? []}
            churchId={churchId}
            loading={loading}
            onSubmit={handleSubmit}
            onSubmitSchedule={handleReplace}
          />
        ) : (
          <Skeleton />
        )}
      </Card>
    </Fragment>
  )
}
