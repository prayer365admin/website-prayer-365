'use client'

import { ChurchListItem } from '@/models/central-church'
import { Button, Space, TableProps } from 'antd'
import ChurchStatusTag from './status'

/**
 * S15 columns (Figma parity): Church / Country / Organization / Status / Actions.
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
    width: '28%',
    render: (_, church) => (
      <span
        className="text-sm font-semibold text-primary-900 cursor-pointer hover:text-primary-500"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(church)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpen(church)
        }}
      >
        {church.name}
      </span>
    ),
  },
  {
    key: 'country',
    title: 'Country',
    width: '18%',
    render: (_, church) => (
      <span className="text-xs font-normal text-neutral-600">
        {church.country ?? church.countryCode ?? '—'}
      </span>
    ),
  },
  {
    key: 'organization',
    title: 'Organization',
    width: '28%',
    render: (_, church) => (
      <span className="text-xs font-normal text-[#8f96a3]">
        {church.organization.length ? church.organization.join(' / ') : '—'}
      </span>
    ),
  },
  {
    key: 'status',
    title: 'Status',
    align: 'center',
    width: '16%',
    render: (_, church) => <ChurchStatusTag status={church.status} />,
  },
  {
    key: 'actions',
    title: 'Actions',
    align: 'right',
    width: '10%',
    render: (_, church) => (
      <Space size={4} className="w-full justify-end">
        <Button
          type="link"
          size="small"
          className="!p-0 !h-auto text-xs font-semibold text-primary-500 hover:!text-primary-700"
          onClick={() => onOpen(church)}
        >
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
