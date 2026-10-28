'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useAnnouncements } from '@/hooks/data/announcement'
import { useCurrentChurch } from '@/hooks/data/church'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { AnnouncementInput, AnnouncementOutput, AnnouncementStatus } from '@/models/announcement'
import { ANNOUNCEMENT_STATUS, announcementStatusLabels } from '@/utils/constant'
import { PlusCircleFilled } from '@ant-design/icons'
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Table,
  TablePaginationConfig,
} from 'antd'
import { Dayjs } from 'dayjs'
import { useState } from 'react'
import { AnnouncementColumns } from './columns'
import AnnouncementEditor from './editor'
import { churchFilterBoundToIso, EVENT_EDITOR_DATETIME_FORMAT } from '@/utils/event-datetime'

export default function ContentsChurchAnnouncements({ churchId }: { churchId: string }) {
  const [search, setSearch] = useState<string>()
  const [status, setStatus] = useState<AnnouncementStatus>()
  const [publishedRange, setPublishedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [orderBy, setOrderBy] = useState<'created_at' | 'title' | 'published_at'>('created_at')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementOutput>()

  const permission = useAccessPermission()
  const { data: church, loading: churchLoading } = useCurrentChurch(churchId)
  const timezone = church?.timezone
  const canCreate =
    permission.createAny('prayer_announcement').granted ||
    permission.createOwn('prayer_announcement').granted
  // Publish/unpublish is its own permission; editing alone must not publish.
  const canPublish =
    permission.updateAny('prayer_announcement_publication').granted ||
    permission.updateOwn('prayer_announcement_publication').granted
  const {
    data,
    total,
    loading,
    saving,
    publishingId,
    unpublishingId,
    error,
    onCreate,
    onUpdate,
    onPublish,
    onUnpublish,
    onDelete,
  } = useAnnouncements({
    churchId,
    page,
    limit: pageSize,
    search,
    status,
    publishedFrom:
      publishedRange?.[0] && timezone
        ? churchFilterBoundToIso(publishedRange[0], timezone)
        : undefined,
    publishedTo:
      publishedRange?.[1] && timezone
        ? churchFilterBoundToIso(publishedRange[1], timezone)
        : undefined,
    orderBy,
    orderDirection,
  })
  const openCreate = () => {
    setEditingAnnouncement(undefined)
    setEditorOpen(true)
  }
  const openEdit = (announcement: AnnouncementOutput) => {
    // Keep the exact displayed snapshot so its fields and optimistic version
    // cannot drift if the list refreshes while the editor is open.
    setEditingAnnouncement(announcement)
    setEditorOpen(true)
  }
  const closeEditor = () => setEditorOpen(false)
  const saveAnnouncement = async (payload: AnnouncementInput) => {
    if (editingAnnouncement && payload.version !== undefined) {
      await onUpdate({
        announcementId: editingAnnouncement.id,
        payload: { ...payload, version: payload.version },
      })
    } else if (payload.version === undefined) {
      await onCreate(payload)
    }
    closeEditor()
  }
  const publishAnnouncement = (announcement: AnnouncementOutput) =>
    onPublish({ announcementId: announcement.id, version: announcement.version })
  const unpublishAnnouncement = (announcement: AnnouncementOutput) =>
    onUnpublish({ announcementId: announcement.id, version: announcement.version })
  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize) setPageSize(pagination.pageSize)
  }

  return (
    <>
      <DashboardMainHeader
        title="Announcements"
        description="Create church news and publish it immediately to the mobile app."
      >
        {canCreate && (
          <Col>
            <Button type="primary" size="large" icon={<PlusCircleFilled />} onClick={openCreate}>
              Create announcement
            </Button>
          </Col>
        )}
      </DashboardMainHeader>

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
            disabled={!timezone || status === ANNOUNCEMENT_STATUS.DRAFT}
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

      <Table<AnnouncementOutput>
        rowKey="id"
        size="small"
        columns={
          timezone
            ? AnnouncementColumns({
                canPublish,
                publishingId,
                unpublishingId,
                timezone,
                onEdit: openEdit,
                onPublish: publishAnnouncement,
                onUnpublish: unpublishAnnouncement,
                onDelete: (announcement) =>
                  onDelete({ announcementId: announcement.id, version: announcement.version }),
              })
            : []
        }
        dataSource={data ?? []}
        loading={loading || churchLoading}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="No announcements found for this church." /> }}
        onChange={(pagination, _filters, sorter) => {
          if (!Array.isArray(sorter) && sorter.order) {
            const sortable = ['created_at', 'title', 'published_at'] as const
            if (sortable.includes(sorter.columnKey as (typeof sortable)[number])) {
              setOrderBy(sorter.columnKey as (typeof sortable)[number])
              setOrderDirection(sorter.order === 'ascend' ? 'asc' : 'desc')
            }
          }
          handlePagination(pagination)
        }}
        pagination={{ total, current: page, pageSize }}
      />

      <AnnouncementEditor
        open={editorOpen}
        announcement={editingAnnouncement}
        loading={saving}
        onCancel={closeEditor}
        afterClose={() => setEditingAnnouncement(undefined)}
        onSubmit={saveAnnouncement}
      />
    </>
  )
}
