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
  return <Tag color={COLORS[status]}>{CHURCH_STATUS_LABELS[status]}</Tag>
}
