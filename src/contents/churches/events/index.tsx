'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useChurch, useChurchProfile } from '@/hooks/data/church'
import { useEvents } from '@/hooks/data/event'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import {
  EventCategory,
  EventCategorySchema,
  EventCreateInput,
  EventOutput,
  EventUpdateInput,
} from '@/models/event'
import { categoryLabels } from '@/utils/constant'
import { churchFilterBoundToIso, EVENT_EDITOR_DATETIME_FORMAT } from '@/utils/event-datetime'
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
import { useState } from 'react'
import { EventColumns } from './columns'
import EventEditor from './editor'

export default function ContentsChurchEvents({ churchId }: { churchId: string }) {
  const [search, setSearch] = useState<string>()
  const [category, setCategory] = useState<EventCategory>()
  const [hasLink, setHasLink] = useState<'yes' | 'no'>()
  const [startsFrom, setStartsFrom] = useState<string>()
  const [startsTo, setStartsTo] = useState<string>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string>()

  const permission = useAccessPermission()
  const canCreate =
    permission.createAny('prayer_event').granted || permission.createOwn('prayer_event').granted
  const { data: church, loading: churchLoading } = useChurch(churchId)
  const { data: churchProfile, loading: profileLoading } = useChurchProfile(churchId)
  const { data, total, loading, error, onCreate, onUpdate } = useEvents({
    churchId,
    page,
    limit: pageSize,
    search,
    category,
    has_link: hasLink,
    starts_from: startsFrom,
    starts_to: startsTo,
    orderBy: 'starts_at',
    orderDirection,
  })
  const editingEvent = editingEventId
    ? data?.find((event) => event.id === editingEventId)
    : undefined
  const timezone = church?.timezone

  const openCreate = () => {
    setEditingEventId(undefined)
    setEditorOpen(true)
  }
  const openEdit = (event: EventOutput) => {
    setEditingEventId(event.id)
    setEditorOpen(true)
  }
  // Keep editingEventId until afterClose so the modal keeps its content during the close animation.
  const closeEditor = () => setEditorOpen(false)
  const saveEvent = async (payload: EventCreateInput | EventUpdateInput) => {
    // Edit intent but the row left the current list (e.g. refetch under a filter) before save:
    // do not duplicate-create it. Keep the editor open for the staff member to cancel.
    if (editingEventId && payload.version === undefined) return
    if (editingEventId && payload.version !== undefined) {
      await onUpdate({ eventId: editingEventId, payload: { ...payload, version: payload.version } })
    } else if (payload.version === undefined) {
      await onCreate(payload)
    }
    closeEditor()
  }
  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize) setPageSize(pagination.pageSize)
  }

  return (
    <>
      <DashboardMainHeader
        title="Events"
        description="Manage services and church activities shown in the mobile app."
      >
        {canCreate && (
          <Col>
            <Button
              type="primary"
              size="large"
              icon={<PlusCircleFilled />}
              onClick={openCreate}
              disabled={!timezone || !churchProfile}
            >
              Create event
            </Button>
          </Col>
        )}
      </DashboardMainHeader>

      <Row justify="space-between" gutter={[8, 8]} className="mb-2">
        <Col className="w-full lg:w-[50%] flex gap-2">
          <Select
            allowClear
            className="w-full md:w-44"
            placeholder="Filter category"
            value={category}
            onChange={(value) => {
              setCategory(value)
              setPage(1)
            }}
            options={EventCategorySchema.options.map((value) => ({
              value,
              label: categoryLabels[value],
            }))}
          />
          <Select
            allowClear
            className="w-full md:w-44"
            placeholder="Registration link"
            value={hasLink}
            onChange={(value) => {
              setHasLink(value)
              setPage(1)
            }}
            options={[
              { value: 'yes', label: 'With link' },
              { value: 'no', label: 'Without link' },
            ]}
          />
          <DatePicker.RangePicker
            showTime={{ format: 'HH:mm' }}
            format={EVENT_EDITOR_DATETIME_FORMAT}
            placeholder={['Starts from', 'Starts until']}
            disabled={!timezone}
            allowEmpty={[true, true]}
            onChange={(range) => {
              const [from, to] = range ?? []
              setStartsFrom(from && timezone ? churchFilterBoundToIso(from, timezone) : undefined)
              setStartsTo(to && timezone ? churchFilterBoundToIso(to, timezone) : undefined)
              setPage(1)
            }}
          />
        </Col>
        <Col xs={24} lg={8}>
          <SearchInput
            placeholder="Search title or location"
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
          message="Events could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <Table<EventOutput>
        rowKey="id"
        size="small"
        columns={timezone ? EventColumns({ timezone, onEdit: openEdit }) : []}
        dataSource={data ?? []}
        loading={loading || churchLoading || profileLoading}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="No events found for this church." /> }}
        onChange={(pagination, _filters, sorter) => {
          if (!Array.isArray(sorter) && sorter.columnKey === 'starts_at' && sorter.order) {
            setOrderDirection(sorter.order === 'ascend' ? 'asc' : 'desc')
          }
          handlePagination(pagination)
        }}
        pagination={{ total, current: page, pageSize }}
      />

      {timezone && churchProfile && (
        <EventEditor
          open={editorOpen}
          event={editingEvent}
          timezone={timezone}
          languageCodes={churchProfile.languageCodes}
          loading={loading}
          onCancel={closeEditor}
          afterClose={() => setEditingEventId(undefined)}
          onSubmit={saveEvent}
        />
      )}
    </>
  )
}
