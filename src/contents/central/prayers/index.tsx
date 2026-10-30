'use client'

import SiteButton from '@/components/common/button'
import SearchInput from '@/components/common/search-input'
import { useChurches } from '@/hooks/data/church'
import { useCentralPrayers } from '@/hooks/data/prayer'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { PlusOutlined } from '@ant-design/icons'
import { Select, Table } from 'antd'
import { useRouter } from 'next/navigation'
import { CSSProperties, useState } from 'react'
import { CentralPrayerColumns } from './columns'
import styles from './index.module.scss'

const STATUS_OPTIONS = [
  { value: 'current', label: 'Draft' },
  { value: 'archive', label: 'Published' },
] as const

const selectTextStyle: CSSProperties = {
  fontFamily: 'var(--font-text)',
  fontSize: 14,
  fontStyle: 'normal',
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: '150%',
  verticalAlign: 'middle',
}

export default function ContentsCentralPrayers() {
  const router = useRouter()
  const [search, setSearch] = useState<string | undefined>('')
  const [status, setStatus] = useState<'current' | 'archive' | undefined>()
  const [churchId, setChurchId] = useState<string | undefined>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [orderBy, setOrderBy] = useState<'created_at' | 'published_at'>('created_at')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')

  const { data: churches } = useChurches({
    queryString: '',
    limit: 100,
    page: 1,
    orderBy: 'name',
    orderDirection: 'asc',
  })
  const churchOptions = (churches ?? []).map((church) => ({
    value: church.id,
    label: <span style={selectTextStyle}>{church.name}</span>,
    searchLabel: church.name,
  }))
  const { data, total, loading } = useCentralPrayers({
    page,
    limit: pageSize,
    search: search || undefined,
    status,
    churchId,
    orderBy,
    orderDirection,
  })

  const createPrayer = () => {
    router.push('/dashboard/central/prayers/new')
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Prayers</h1>
          <p>Prayers from every church. Open one to review, publish or manage its audio.</p>
        </div>
        <SiteButton
          className={styles.newPrayerButton}
          icon={<PlusOutlined aria-hidden />}
          iconPlacement="start"
          onClick={createPrayer}
          size="md"
        >
          New Prayer
        </SiteButton>
      </header>

      <div className={styles.contentCard}>
        <div className={styles.filterBar}>
          <div className={styles.searchControl}>
            <SearchInput
              iconPosition="prefix"
              loading={loading}
              placeholder="Search Prayer"
              setPage={setPage}
              setPageSize={setPageSize}
              setValue={setSearch}
            />
          </div>
          <div className={styles.churchControl}>
            <Select
              allowClear
              aria-label="Filter church"
              className="w-full w-min-30"
              onChange={(value) => {
                setChurchId(value)
                setPage(1)
              }}
              options={churchOptions}
              placeholder={<span style={selectTextStyle}>All Church</span>}
              showSearch={{
                filterOption: (input, option) =>
                  (option?.searchLabel ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
              value={churchId}
            />
          </div>
          <div className={styles.statusControl}>
            <Select
              allowClear
              aria-label="Filter status"
              className="w-full"
              onChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
              options={STATUS_OPTIONS.map((option) => ({
                value: option.value,
                label: <span style={selectTextStyle}>{option.label}</span>,
              }))}
              placeholder={<span style={selectTextStyle}>All Status</span>}
              value={status}
            />
          </div>
        </div>

        <div className={styles.tableRegion}>
          <Table
            columns={CentralPrayerColumns({
              page,
              pageSize,
              onOpen: (_church, prayer) => router.push(`/dashboard/central/prayers/${prayer}`),
            })}
            dataSource={data}
            loading={loading}
            onChange={(pagination, _filters, sorter) => {
              const sort = Array.isArray(sorter) ? sorter[0] : sorter
              if (sort?.order && sort.columnKey === 'published_at') {
                setOrderBy('published_at')
                setOrderDirection(sort.order === 'ascend' ? 'asc' : 'desc')
              } else if (!sort?.order) {
                setOrderBy('created_at')
                setOrderDirection('desc')
              }
              if (pagination.current) setPage(pagination.current)
              if (pagination.pageSize) setPageSize(pagination.pageSize)
            }}
            pagination={{
              current: page,
              pageSize,
              showLessItems: true,
              showSizeChanger: false,
              showTotal: (count, range) =>
                `Showing ${range[0]} - ${range[1]} of ${count.toLocaleString()} prayers`,
              total,
            }}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            size="small"
          />
        </div>
      </div>
    </section>
  )
}
