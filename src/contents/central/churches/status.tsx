'use client'

import type { ChurchStatus } from '@prisma/client'
import { Tag } from 'antd'

export const CHURCH_STATUS_LABELS: Record<ChurchStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
}

const COLORS: Record<ChurchStatus, string> = {
  PENDING: 'gold',
  APPROVED: 'green',
  SUSPENDED: 'orange',
  ARCHIVED: 'default',
}

export default function ChurchStatusTag({ status }: { status: ChurchStatus }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#edfdf9] border border-[#d3faef] text-[#09a97c] text-xs font-semibold leading-none w-fit self-start shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#09a97c] shrink-0" />
        {CHURCH_STATUS_LABELS.APPROVED}
      </span>
    )
  }
  return (
    <Tag color={COLORS[status]} className="w-fit self-start shrink-0">
      {CHURCH_STATUS_LABELS[status]}
    </Tag>
  )
}
