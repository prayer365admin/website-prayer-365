'use client'

import { ChurchListItem } from '@/models/central-church'
import { Button, Space, TableProps, Typography } from 'antd'
import ChurchStatusTag from './status'

/**
 * S15 columns (DESIGN.md): Church / Country / Organization / State / Action.
 * Delete appears only for a PENDING church — the one case the API can purge
 * (every church with history must be archived instead).
 */
export const CentralChurchColumns = ({
  canDelete,
  onOpen,
  onPurge,
}: {
  canDelete: boolean
  onOpen: (church: ChurchListItem) => void
  onPurge: (church: ChurchListItem) => void
}): TableProps<ChurchListItem>['columns'] => [
  {
    key: 'name',
    title: 'Church',
    render: (_, church) => (
      <Typography.Link onClick={() => onOpen(church)}>{church.name}</Typography.Link>
    ),
  },
  {
    key: 'country',
    title: 'Country',
    render: (_, church) => church.country ?? church.countryCode ?? '—',
  },
  {
    key: 'organization',
    title: 'Organization',
    render: (_, church) => (church.organization.length ? church.organization.join(' / ') : '—'),
  },
  {
    key: 'status',
    title: 'State',
    render: (_, church) => <ChurchStatusTag status={church.status} />,
  },
  {
    key: 'actions',
    title: 'Action',
    render: (_, church) => (
      <Space size={4}>
        <Button type="link" size="small" onClick={() => onOpen(church)}>
          Open
        </Button>
        {canDelete && church.status === 'PENDING' && (
          <Button type="link" size="small" danger onClick={() => onPurge(church)}>
            Delete
          </Button>
        )}
      </Space>
    ),
  },
]
