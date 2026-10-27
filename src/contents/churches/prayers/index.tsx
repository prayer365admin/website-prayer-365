'use client'

import AddButton from '@/components/common/add-button'
import { usePrayers } from '@/hooks/data/prayer'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { Tabs, Table } from 'antd'
import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import { PrayerColumns } from './columns'

export default function ContentsChurchesPrayers({ churchId }: { churchId: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<'current' | 'archive'>('current')
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()

  const orderBy = tab === 'current' ? 'created_at' : 'published_at'

  const {
    data: prayerData,
    loading: prayerLoading,
    total: prayerTotal,
  } = usePrayers({
    churchId,
    page,
    limit: pageSize,
    orderBy,
    orderDirection: 'desc',
    status: tab,
  })

  const handleTabChange = (key: string) => {
    setTab(key as 'current' | 'archive')
    setPage(1)
  }

  const columns = PrayerColumns({
    page,
    pageSize,
    onOpen: (prayerId) => {
      router.push(`/dashboard/churches/${churchId}/prayers/${prayerId}`)
    },
  })

  return (
    <Fragment>
      <div>
        <AddButton
          label="New Prayer"
          onClick={() => {
            router.push(`/dashboard/churches/${churchId}/prayers/new`)
          }}
        />
        <Tabs
          activeKey={tab}
          onChange={handleTabChange}
          items={[
            { key: 'current', label: 'Current / Upcoming' },
            { key: 'archive', label: 'Published archive' },
          ]}
        />
        <Table
          columns={columns}
          dataSource={prayerData}
          loading={prayerLoading}
          key={'prayer-table'}
          rowKey={'id'}
          pagination={{
            total: prayerTotal,
            current: page,
            pageSize: pageSize,
            onChange: (current, size) => {
              setPage(current)
              setPageSize(size)
            },
          }}
        />
      </div>
    </Fragment>
  )
}
