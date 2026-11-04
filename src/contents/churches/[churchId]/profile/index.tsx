'use client'

import { useChurchProfile, useChurchServiceTimes } from '@/hooks/data/church'
import { ChurchProfileInput, ChurchProfileOutput } from '@/models/church'
import { ServiceTimeScheduleInput } from '@/models/service-time'
import { Skeleton } from 'antd'
import { useParams } from 'next/navigation'
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

  if (!data || !serviceTimes) {
    return (
      <div className="max-w-[1184px] mx-auto bg-white rounded-2xl p-6 shadow-sm w-full flex-1 min-h-[700px]">
        <Skeleton avatar={false} paragraph={{ rows: 8 }} active />
      </div>
    )
  }

  return (
    <FormChurchProfileTabs
      initialValues={data}
      serviceTimes={serviceTimes ?? []}
      churchId={churchId}
      loading={loading}
      onSubmit={handleSubmit}
      onSubmitSchedule={handleReplace}
    />
  )
}
