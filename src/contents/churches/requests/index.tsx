'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { RequestKind, useRequests } from '@/hooks/data/request'
import { RequestListSummary } from '@/models/request'
import { Alert, Col, DatePicker, Empty, Result, Row, Select, Table, Tabs } from 'antd'
import { Dayjs } from 'dayjs'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { RequestColumns, requestDetailHref } from './columns'

/*
 * S10 request list (F7RQ RQ-04). Shows only what the server returns for this
 * caller: private and pastoral/meeting rows are filtered server-side before
 * count/pagination, and every filter here only narrows that set. View only,
 * no status/assignment (D3). A 404 means no request access at this church,
 * shown without any counts.
 */

const TABS: { key: string; label: string; kinds: RequestKind[] }[] = [
  { key: 'prayer', label: 'Prayer requests', kinds: ['prayer'] },
  { key: 'pastoral', label: 'Pastoral / Meeting requests', kinds: ['pastoral', 'meeting'] },
]

const CLASSIFICATION_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'standard', label: 'Standard' },
]

const TYPE_OPTIONS = [
  { value: 'pastoral', label: 'Pastoral request' },
  { value: 'meeting', label: 'Meeting request' },
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
  const [search, setSearch] = useState<string>()
  const [classification, setClassification] = useState<'private' | 'standard'>()
  const [type, setType] = useState<RequestKind>()
  const [receivedRange, setReceivedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)

  const { data, total, loading, fetching, error, notFound } = useRequests({
    churchId,
    kinds: type ? [type] : tab.kinds,
    search,
    // Classification only applies to prayer requests; pastoral/meeting are always Restricted.
    classification: tab.key === 'prayer' ? classification : undefined,
    // Whole days in the viewer's timezone, matching how "Received" is shown.
    receivedFrom: receivedRange?.[0]?.startOf('day').toISOString(),
    receivedTo: receivedRange?.[1]?.endOf('day').toISOString(),
    page,
    limit: pageSize,
    orderDirection,
  })

  const selectTab = (key: string) => {
    setPage(1)
    setClassification(undefined)
    setType(undefined)
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

          <Row justify="space-between" gutter={[8, 8]} className="mb-2">
            <Col className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
              {tab.key === 'prayer' ? (
                <Select
                  allowClear
                  className="w-full sm:w-48"
                  placeholder="Filter classification"
                  aria-label="Filter classification"
                  value={classification}
                  onChange={(value) => {
                    setClassification(value)
                    setPage(1)
                  }}
                  options={CLASSIFICATION_OPTIONS}
                />
              ) : (
                <Select
                  allowClear
                  className="w-full sm:w-48"
                  placeholder="Filter type"
                  aria-label="Filter type"
                  value={type}
                  onChange={(value) => {
                    setType(value)
                    setPage(1)
                  }}
                  options={TYPE_OPTIONS}
                />
              )}
              <DatePicker.RangePicker
                className="w-full sm:w-auto"
                value={receivedRange}
                placeholder={['Received from', 'Received until']}
                allowEmpty={[true, true]}
                onChange={(range) => {
                  setReceivedRange(range)
                  setPage(1)
                }}
              />
            </Col>
            <Col xs={24} lg={8}>
              <SearchInput
                placeholder="Search request subject"
                setValue={setSearch}
                setPage={setPage}
                setPageSize={setPageSize}
              />
            </Col>
          </Row>

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
            columns={RequestColumns({
              onOpen: (r) => router.push(requestDetailHref(churchId, r.id)),
            })}
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
