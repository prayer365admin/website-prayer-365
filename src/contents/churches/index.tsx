'use client'

import { useChurches } from '@/hooks/data/church'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { Button, Empty, Select, Table, Tag, Typography } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useState } from 'react'
import ChurchAccessNotice from '@/components/container/dashboard/church-scope-guard/access-notice'

const STATUS_COLORS: Record<string, string> = {
  APPROVED: 'green',
  PENDING: 'gold',
  SUSPENDED: 'orange',
  ARCHIVED: 'default',
}

const STATUS_OPTIONS = ['APPROVED', 'PENDING', 'SUSPENDED', 'ARCHIVED'] as const

export default function ContentsChurches() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const denied = searchParams.get('notice') === 'church_access_denied'
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  // Plan 023: the super admin's list covers every lifecycle status, so it needs a
  // marker and a filter instead of an unlabelled mix.
  const [status, setStatus] = useState<string>()

  const {
    data: churches,
    total,
    loading: churchesLoading,
  } = useChurches({
    queryString: ``,
    limit: pageSize,
    page,
    orderBy: 'name',
    orderDirection: 'asc',
    status,
  })

  useEffect(() => {
    // Never auto-open a church while a filter is active: the single row may be
    // just the filtered result, not the caller's whole scope.
    if (!status && !churchesLoading && total === 1 && churches?.[0]) {
      router.replace(
        `/dashboard/churches/${churches[0].id}${denied ? '?notice=church_access_denied' : ''}`,
      )
    }
  }, [churches, churchesLoading, denied, router, status, total])

  if (!status && total === 1 && churches?.[0]) {
    return null // redirecting to the single church overview
  }

  const columns = [
    { key: 'name', dataIndex: 'name', title: 'Church', render: (text: string) => text },
    {
      key: 'city',
      dataIndex: 'city',
      title: 'Location',
      render: (text: string | null) => text ?? '-',
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: 'Status',
      render: (text: string) => <Tag color={STATUS_COLORS[text] ?? 'default'}>{text}</Tag>,
    },
    {
      key: 'access',
      title: 'Access',
      render: () => session?.user?.role?.name ?? '-',
    },
    {
      key: 'actions',
      title: 'Action',
      render: (_text: unknown, record: { id: string }) => (
        <Button type="link" onClick={() => router.push(`/dashboard/churches/${record.id}`)}>
          Open
        </Button>
      ),
    },
  ]

  return (
    <Fragment>
      <ChurchAccessNotice />
      <Typography.Title level={2}>Choose Church</Typography.Title>
      <Typography.Text type="secondary">Select a church assigned to your account.</Typography.Text>
      <div className="my-3">
        <Select
          allowClear
          className="w-full sm:w-52"
          placeholder="Filter status"
          value={status}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
          options={STATUS_OPTIONS.map((value) => ({ value, label: value }))}
        />
      </div>
      <Table
        columns={columns}
        dataSource={churches ?? []}
        loading={churchesLoading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage)
            setPageSize(nextPageSize)
          },
        }}
        locale={{
          emptyText: (
            <Empty description="No assigned churches. Contact your administrator to get church access." />
          ),
        }}
      />
    </Fragment>
  )
}
