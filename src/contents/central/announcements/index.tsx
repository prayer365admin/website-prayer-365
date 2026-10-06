'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useAnnouncementActions, useCentralAnnouncements } from '@/hooks/data/announcement'
import { AnnouncementListItem, AnnouncementStatus } from '@/models/announcement'
import { ANNOUNCEMENT_STATUS, announcementStatusLabels } from '@/utils/constant'
import { EVENT_EDITOR_DATETIME_FORMAT } from '@/utils/event-datetime'
import { Alert, Col, DatePicker, Empty, Row, Select, Table, TablePaginationConfig } from 'antd'
import { Dayjs } from 'dayjs'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CentralAnnouncementColumns } from './columns'

const SORTABLE = ['created_at', 'title', 'published_at'] as const

export default function ContentsCentralAnnouncements() {
  const [search, setSearch] = useState<string>()
  const [status, setStatus] = useState<AnnouncementStatus>()
  // Churches span timezones, so the range is picked in the viewer's local time.
  const [publishedRange, setPublishedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [orderBy, setOrderBy] = useState<(typeof SORTABLE)[number]>('created_at')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')

  const router = useRouter()
  const permission = useAccessPermission()
  const canPublish =
    permission.updateAny('prayer_announcement_publication').granted ||
    permission.updateOwn('prayer_announcement_publication').granted
  const { publishingId, unpublishingId, onPublish, onUnpublish, onDelete } =
    useAnnouncementActions()
  const { data, total, loading, error } = useCentralAnnouncements({
    page,
    limit: pageSize,
    search,
    status,
    publishedFrom: publishedRange?.[0]?.toISOString(),
    publishedTo: publishedRange?.[1]?.toISOString(),
    orderBy,
    orderDirection,
  })

  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize) setPageSize(pagination.pageSize)
  }

  return (
    <>
      <DashboardMainHeader
        title="Announcements"
        description="Announcements from every church."
        buttonLabel="Create announcement"
        url="/dashboard/central/announcements/create"
        buttonPermissionSubject="prayer_announcement"
      />

      <Row justify="space-between" gutter={[8, 8]} className="mb-2">
        <Col className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
          <Select
            allowClear
            className="w-full sm:w-44"
            placeholder="Filter status"
            value={status}
            onChange={(value) => {
              setStatus(value)
              if (value === ANNOUNCEMENT_STATUS.DRAFT) setPublishedRange(null)
              setPage(1)
            }}
            options={[ANNOUNCEMENT_STATUS.PUBLISHED, ANNOUNCEMENT_STATUS.DRAFT].map((value) => ({
              value,
              label: announcementStatusLabels[value],
            }))}
          />
          <DatePicker.RangePicker
            className="w-full sm:w-auto"
            value={publishedRange}
            showTime={{ format: 'HH:mm' }}
            format={EVENT_EDITOR_DATETIME_FORMAT}
            placeholder={['Published from', 'Published until']}
            disabled={status === ANNOUNCEMENT_STATUS.DRAFT}
            allowEmpty={[true, true]}
            onChange={(range) => {
              setPublishedRange(range)
              setPage(1)
            }}
          />
        </Col>
        <Col xs={24} lg={8}>
          <SearchInput
            placeholder="Search announcement title"
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
          message="Announcements could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <Table<AnnouncementListItem>
        rowKey="id"
        size="small"
        columns={CentralAnnouncementColumns({
          canPublish,
          publishingId,
          unpublishingId,
          onEdit: (announcement) =>
            router.push(`/dashboard/central/announcements/${announcement.id}`),
          onPublish: ({ id, churchId, version }) =>
            onPublish({ announcementId: id, churchId, version }),
          onUnpublish: ({ id, churchId, version }) =>
            onUnpublish({ announcementId: id, churchId, version }),
          onDelete: ({ id, churchId, version }) =>
            onDelete({ announcementId: id, churchId, version }),
        })}
        dataSource={data ?? []}
        loading={loading}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="No announcements found." /> }}
        onChange={(pagination, _filters, sorter) => {
          if (!Array.isArray(sorter) && sorter.order) {
            const key = sorter.columnKey as (typeof SORTABLE)[number]
            if (SORTABLE.includes(key)) {
              setOrderBy(key)
              setOrderDirection(sorter.order === 'ascend' ? 'asc' : 'desc')
            }
          }
          handlePagination(pagination)
        }}
        pagination={{ total, current: page, pageSize }}
      />
    </>
  )
}
