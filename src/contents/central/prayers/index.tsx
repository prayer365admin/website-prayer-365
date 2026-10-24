'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { useChurches } from '@/hooks/data/church'
import { useCentralPrayers } from '@/hooks/data/prayer'
import { Col, Row, Select, Table, TablePaginationConfig } from 'antd'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CentralPrayerColumns } from './columns'

/*
 * S15-central Prayers (plan 023). One list for every church under the central
 * node, so the super admin can find and review a prayer without first picking a
 * church. Approve / publish / audio stay on the per-church prayer screen, which
 * each row opens.
 */

const STATUS_OPTIONS = [
  { value: 'current', label: 'Draft or scheduled' },
  { value: 'archive', label: 'Published' },
] as const

export default function ContentsCentralPrayers() {
  const router = useRouter()
  const [search, setSearch] = useState<string | undefined>('')
  const [status, setStatus] = useState<'current' | 'archive' | undefined>()
  const [churchId, setChurchId] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [orderBy, setOrderBy] = useState<'created_at' | 'published_at'>('created_at')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')

  const { data: churches } = useChurches({ queryString: '', limit: 'ALL' })
  const churchOptions = (churches ?? []).map((church) => ({
    value: church.id,
    label: church.name,
  }))
  const { data, total, loading } = useCentralPrayers({
    page,
    limit: pageSize,
    search,
    status,
    churchId,
    orderBy,
    orderDirection,
  })

  return (
    <>
      <DashboardMainHeader
        title="Prayers"
        description="Prayers from every church. Open one to review, publish or manage its audio."
      />

      <Row justify="space-between" gutter={[8, 8]} className="mb-2">
        <Col className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
          <Select
            allowClear
            className="w-full sm:w-56"
            placeholder="Filter church"
            value={churchId}
            onChange={(value) => {
              setChurchId(value)
              setPage(1)
            }}
            options={churchOptions}
            showSearch
            optionFilterProp="label"
          />
          <Select
            allowClear
            className="w-full sm:w-52"
            placeholder="Filter publication"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={STATUS_OPTIONS.map((option) => ({ ...option }))}
          />
        </Col>
        <Col className="w-full lg:w-auto">
          <SearchInput
            placeholder="Search prayer title"
            setValue={setSearch}
            setPage={setPage}
            setPageSize={setPageSize}
            loading={loading}
          />
        </Col>
      </Row>

      <Table
        columns={CentralPrayerColumns({
          onOpen: (church, prayer) =>
            router.push(`/dashboard/churches/${church}/prayers/${prayer}`),
        })}
        dataSource={data}
        loading={loading}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true }}
        onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
          if (pagination.current) setPage(pagination.current)
          if (pagination.pageSize) setPageSize(pagination.pageSize)
          const sort = Array.isArray(sorter) ? sorter[0] : sorter
          if (sort?.order && (sort.field === 'created_at' || sort.field === 'published_at')) {
            setOrderBy(sort.field as 'created_at' | 'published_at')
            setOrderDirection(sort.order === 'ascend' ? 'asc' : 'desc')
          }
        }}
      />
    </>
  )
}
