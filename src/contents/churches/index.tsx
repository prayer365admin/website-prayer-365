'use client'

import { useChurches } from '@/hooks/data/church'
import { Button, Empty, Table, Typography } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect } from 'react'

export default function ContentsChurches() {
  const router = useRouter()
  const { data: session } = useSession()

  const { data: churches, loading: churchesLoading } = useChurches({
    queryString: ``,
    limit: 100,
    page: 1,
    orderBy: 'name',
    orderDirection: 'asc',
  })

  useEffect(() => {
    if (!churchesLoading && churches && churches.length === 1) {
      router.replace(`/dashboard/churches/${churches[0].id}`)
    }
  }, [churches, churchesLoading, router])

  if (churches && churches.length === 1) {
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
      <Typography.Title level={2}>Choose Church</Typography.Title>
      <Typography.Text type="secondary">Select a church assigned to your account.</Typography.Text>
      <Table
        columns={columns}
        dataSource={churches ?? []}
        loading={churchesLoading}
        rowKey="id"
        pagination={false}
        locale={{
          emptyText: (
            <Empty description="No assigned churches. Contact your administrator to get church access." />
          ),
        }}
      />
    </Fragment>
  )
}
