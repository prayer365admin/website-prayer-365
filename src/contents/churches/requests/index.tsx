'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import { RequestKind, useRequests } from '@/hooks/data/request'
import { RequestListSummary } from '@/models/request'
import { Alert, Empty, Result, Table, Tabs } from 'antd'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { RequestColumns } from './columns'

/*
 * S10 request list (F7RQ RQ-04). Shows only what the server returns for this
 * caller: private and pastoral/meeting rows are filtered server-side before
 * count/pagination. View only, no status/assignment (D3). A 404 means no
 * request access at this church, shown without any counts.
 */

const TABS: { key: string; label: string; kinds: RequestKind[] }[] = [
  { key: 'prayer', label: 'Prayer requests', kinds: ['prayer'] },
  { key: 'pastoral', label: 'Pastoral / Meeting requests', kinds: ['pastoral', 'meeting'] },
]

export default function ContentsChurchRequests({ churchId }: { churchId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Active tab lives in the URL so back/refresh/share keep it.
  const tab = TABS.find((t) => t.key === searchParams.get('tab')) ?? TABS[0]
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')

  const { data, total, loading, fetching, error, notFound } = useRequests({
    churchId,
    kinds: tab.kinds,
    page,
    limit: pageSize,
    orderDirection,
  })

  const selectTab = (key: string) => {
    setPage(1)
    router.replace(`${pathname}?tab=${key}`)
  }

  return (
    <>
      <DashboardMainHeader
        title="Requests"
        description="Read requests sent from the mobile app and contact the sender."
      />

      {notFound ? (
        <Result
          status="403"
          title="You do not have access to requests for this church"
          subTitle="Ask an administrator for request access if you handle requests here."
        />
      ) : (
        <>
          <Tabs
            activeKey={tab.key}
            onChange={selectTab}
            items={TABS.map((t) => ({ key: t.key, label: t.label }))}
          />

          {error && (
            <Alert
              className="mb-4"
              type="error"
              showIcon
              title="Requests could not be loaded"
              description="Refresh the page or try again shortly."
            />
          )}

          <Table<RequestListSummary>
            rowKey="id"
            size="small"
            columns={RequestColumns({ churchId })}
            dataSource={data ?? []}
            loading={loading || fetching}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: <Empty description={`No ${tab.label.toLowerCase()} to show.`} />,
            }}
            onChange={(pagination, _filters, sorter) => {
              if (!Array.isArray(sorter))
                setOrderDirection(sorter.order === 'ascend' ? 'asc' : 'desc')
              if (pagination.pageSize && pagination.pageSize !== pageSize) {
                setPageSize(pagination.pageSize)
                setPage(1)
              } else if (pagination.current) setPage(pagination.current)
            }}
            pagination={{
              current: page,
              pageSize,
              total: total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [10, 25, 50, 100],
            }}
          />

          <Alert
            className="mt-4"
            type="info"
            title="Only requests allowed by your church and sensitive-data permissions are visible."
          />
        </>
      )}
    </>
  )
}
