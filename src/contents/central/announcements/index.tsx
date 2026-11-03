'use client'

import AddButton from '@/components/common/add-button'
import SearchInput from '@/components/common/search-input'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useAnnouncementActions, useCentralAnnouncements } from '@/hooks/data/announcement'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { AnnouncementListItem } from '@/models/announcement'
import { CalendarOutlined, CloseCircleFilled } from '@ant-design/icons'
import { Alert, Breadcrumb, DatePicker, Empty, Table, TablePaginationConfig } from 'antd'
import { Dayjs } from 'dayjs'
import Link from 'next/link'
import { useState } from 'react'
import { CentralAnnouncementColumns } from './columns'
import ContentsCentralAnnouncementEditor, {
  type CentralAnnouncementEditorMode,
} from './editor-drawer'

const SORTABLE = ['created_at', 'title', 'published_at'] as const

type EditorState = { mode: CentralAnnouncementEditorMode; id?: string }

function PublishedDateFilter({
  value,
  onChange,
}: {
  value: [Dayjs | null, Dayjs | null] | null
  onChange: (range: [Dayjs | null, Dayjs | null] | null) => void
}) {
  const [open, setOpen] = useState(false)
  const hasValue = Boolean(value?.[0] || value?.[1])

  const fromText = value?.[0] ? value[0].format('YYYY-MM-DD') : 'Published from'
  const untilText = value?.[1] ? value[1].format('YYYY-MM-DD') : 'Published until'

  return (
    <div
      className={`relative h-10 w-[356px] rounded-lg border bg-white px-3 flex items-center justify-between gap-2 transition-all cursor-pointer ${
        open
          ? '!border-[#2F7AD2] !border-b-2 !border-b-[#2F7AD2]'
          : 'border-[#DDE0E4] hover:border-[#B0B6BF]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 pointer-events-none select-none">
        <CalendarOutlined className="!text-[#0E203E] text-sm shrink-0" />
        <span
          className={`text-sm truncate ${
            value?.[0] ? 'font-normal text-[#0E203E]' : 'font-normal text-[#393E46]'
          }`}
        >
          {fromText}
        </span>
      </div>

      <svg
        width="15"
        height="12"
        viewBox="0 0 15 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 pointer-events-none select-none"
        aria-hidden="true"
      >
        <path
          opacity="0.3"
          d="M13.8086 5.98828L9.21484 10.582L8.75 11.0469L7.84766 10.1172L8.3125 9.65234L11.7852 6.17969H0V4.86719H11.7852L8.3125 1.39453L7.84766 0.929688L8.75 0L9.21484 0.464844L13.8086 5.05859L14.2734 5.52344L13.8086 5.98828Z"
          fill="#0E203E"
        />
      </svg>

      <div className="flex items-center gap-2 min-w-0 flex-1 ml-2 pointer-events-none select-none">
        <CalendarOutlined className="!text-[#0E203E] text-sm shrink-0" />
        <span
          className={`text-sm truncate ${
            value?.[1] ? 'font-normal text-[#0E203E]' : 'font-normal text-[#393E46]'
          }`}
        >
          {untilText}
        </span>
      </div>

      {hasValue && (
        <CloseCircleFilled
          className="text-gray-400 hover:text-gray-600 text-xs shrink-0 z-10 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            onChange(null)
          }}
        />
      )}
      <DatePicker.RangePicker
        className="!absolute !inset-0 !opacity-0 !w-full !h-full !cursor-pointer z-0 [&_input]:!cursor-pointer [&_.ant-picker-input]:!cursor-pointer [&_.ant-picker-range-separator]:!cursor-pointer [&_.ant-picker-range-separator]:!p-0 [&_.ant-picker-range-separator]:!px-0"
        open={open}
        onOpenChange={setOpen}
        value={value}
        format="YYYY-MM-DD"
        placeholder={['Published from', 'Published until']}
        allowEmpty={[true, true]}
        onChange={onChange}
      />
    </div>
  )
}

export default function ContentsCentralAnnouncements() {
  const [search, setSearch] = useState<string>()
  // Churches span timezones, so the range is picked in the viewer's local time.
  const [publishedRange, setPublishedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [orderBy, setOrderBy] = useState<(typeof SORTABLE)[number]>('created_at')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')
  const [editor, setEditor] = useState<EditorState>()

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
    publishedFrom: publishedRange?.[0] ? publishedRange[0].startOf('day').toISOString() : undefined,
    publishedTo: publishedRange?.[1] ? publishedRange[1].endOf('day').toISOString() : undefined,
    orderBy,
    orderDirection,
  })

  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize) setPageSize(pagination.pageSize)
  }

  return (
    <div className="flex flex-1 flex-col">
      <Breadcrumb
        className="mb-4 shrink-0 [&_ol]:!flex [&_ol]:!items-center [&_.ant-breadcrumb-item]:!inline-flex [&_.ant-breadcrumb-item]:!items-center [&_.ant-breadcrumb-separator]:!inline-flex [&_.ant-breadcrumb-separator]:!items-center [&_.ant-breadcrumb-link]:!inline-flex [&_.ant-breadcrumb-link]:!items-center [&_.ant-breadcrumb-link]:!text-xs [&_.ant-breadcrumb-link]:!text-neutral-600 [&_.ant-breadcrumb-link_a]:!text-xs [&_.ant-breadcrumb-link_a]:!text-neutral-600 [&_.ant-breadcrumb-separator]:!text-xs [&_.ant-breadcrumb-separator]:!text-neutral-600"
        items={[
          {
            title: <Link href="/dashboard">Home</Link>,
          },
          {
            title: 'Announcements',
          },
        ]}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-primary-900 m-0 leading-tight">
            Announcements
          </h1>
          <p className="text-sm font-normal text-neutral-600 m-0 leading-normal">
            Churches announcements
          </p>
        </div>
        <div className="shrink-0 w-full sm:w-auto">
          <AddButton
            label="New Announcements"
            onClick={() => setEditor({ mode: 'create' })}
            permissionSubject="prayer_announcement"
            className="w-full sm:w-auto flex items-center justify-start sm:justify-end mb-0 [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto"
          />
        </div>
      </div>

      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Announcements could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <div className="bg-white rounded-2xl border border-[#dde0e4] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] overflow-hidden flex-1 flex flex-col">
        <div className="box-border flex flex-row flex-wrap items-center px-6 py-4 gap-2 border-b border-[#dde0e4] bg-white shrink-0">
          <div className="w-[280px] max-w-[280px] h-10 [&_.ant-input-affix-wrapper]:!h-10 [&_.ant-input-affix-wrapper]:!rounded-lg [&_.ant-input-affix-wrapper]:!border-[#dde0e4] [&_.ant-input-affix-wrapper]:!px-3 [&_.ant-input]:!text-sm [&_.ant-input]:!text-primary-900 [&_.ant-input::placeholder]:!text-primary-900/45 [&_.ant-input-prefix]:!text-primary-900 [&_.ant-input-prefix]:!mr-2">
            <SearchInput
              placeholder="Search Announcement"
              iconPosition="prefix"
              setValue={setSearch}
              setPage={setPage}
              setPageSize={setPageSize}
            />
          </div>
          <PublishedDateFilter
            value={publishedRange}
            onChange={(range) => {
              setPublishedRange(range)
              setPage(1)
            }}
          />
        </div>

        <div className="bg-white flex-1 flex flex-col [&_.ant-table-wrapper]:flex-1 [&_.ant-table-wrapper]:flex [&_.ant-table-wrapper]:flex-col [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table]:flex-1 [&_.ant-table-pagination]:!mt-auto [&_.ant-table]:!bg-white [&_.ant-table-thead_>_tr_>_th]:!bg-[#fafafb] [&_.ant-table-thead_>_tr_>_th]:!text-neutral-600 [&_.ant-table-thead_>_tr_>_th]:!text-xs [&_.ant-table-thead_>_tr_>_th]:!font-semibold [&_.ant-table-thead_>_tr_>_th]:!py-2 [&_.ant-table-thead_>_tr_>_th]:!px-4 [&_.ant-table-thead_>_tr_>_th:first-child]:!pl-6 [&_.ant-table-thead_>_tr_>_th:last-child]:!pr-6 [&_.ant-table-thead_>_tr_>_th]:!h-[34px] [&_.ant-table-thead_>_tr_>_th]:!border-b [&_.ant-table-thead_>_tr_>_th]:!border-[#dde0e4] [&_.ant-table-measure-row]:!h-0 [&_.ant-table-measure-row_>_td]:!h-0 [&_.ant-table-measure-row_>_td]:!p-0 [&_.ant-table-measure-row_>_td]:!border-0 [&_.ant-table-row_>_td]:!py-4 [&_.ant-table-row_>_td]:!px-4 [&_.ant-table-row_>_td:first-child]:!pl-6 [&_.ant-table-row_>_td:last-child]:!pr-6 [&_.ant-table-row_>_td]:!border-b [&_.ant-table-row_>_td]:!border-[#dde0e4] [&_.ant-table-pagination.ant-pagination]:!mt-auto [&_.ant-table-pagination.ant-pagination]:!mb-0 [&_.ant-table-pagination.ant-pagination]:!mx-0 [&_.ant-table-pagination.ant-pagination]:!px-4 [&_.ant-table-pagination.ant-pagination]:!py-3 [&_.ant-table-pagination.ant-pagination]:!min-h-[57px] [&_.ant-table-pagination.ant-pagination]:!flex [&_.ant-table-pagination.ant-pagination]:!flex-nowrap [&_.ant-table-pagination.ant-pagination]:!items-center [&_.ant-table-pagination.ant-pagination]:!justify-between [&_.ant-table-pagination.ant-pagination]:!border-t [&_.ant-table-pagination.ant-pagination]:!border-[#dde0e4] [&_.ant-pagination-total-text]:!inline-flex [&_.ant-pagination-total-text]:!items-center [&_.ant-pagination-total-text]:!h-8 [&_.ant-pagination-total-text]:!leading-none [&_.ant-pagination-total-text]:!text-xs [&_.ant-pagination-total-text]:!text-[#8f96a3] [&_.ant-pagination-total-text]:!mr-auto [&_.ant-pagination-item]:!inline-flex [&_.ant-pagination-item]:!items-center [&_.ant-pagination-item]:!justify-center [&_.ant-pagination-item]:!p-0 [&_.ant-pagination-item]:!w-8 [&_.ant-pagination-item]:!min-w-[32px] [&_.ant-pagination-item]:!h-8 [&_.ant-pagination-item]:!rounded-lg [&_.ant-pagination-item]:!border [&_.ant-pagination-item]:!border-[#dde0e4] [&_.ant-pagination-item_a]:!flex [&_.ant-pagination-item_a]:!items-center [&_.ant-pagination-item_a]:!justify-center [&_.ant-pagination-item_a]:!w-full [&_.ant-pagination-item_a]:!h-full [&_.ant-pagination-item_a]:!p-0 [&_.ant-pagination-item_a]:!m-0 [&_.ant-pagination-item_a]:!leading-none [&_.ant-pagination-item_a]:!text-xs [&_.ant-pagination-item_a]:!font-semibold [&_.ant-pagination-item_a]:!text-neutral-600 [&_.ant-pagination-prev]:!inline-flex [&_.ant-pagination-prev]:!items-center [&_.ant-pagination-prev]:!justify-center [&_.ant-pagination-prev]:!w-8 [&_.ant-pagination-prev]:!min-w-[32px] [&_.ant-pagination-prev]:!h-8 [&_.ant-pagination-prev_.ant-pagination-item-link]:!flex [&_.ant-pagination-prev_.ant-pagination-item-link]:!items-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!w-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!h-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-prev_.ant-pagination-item-link]:!border [&_.ant-pagination-prev_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-next]:!inline-flex [&_.ant-pagination-next]:!items-center [&_.ant-pagination-next]:!justify-center [&_.ant-pagination-next]:!w-8 [&_.ant-pagination-next]:!min-w-[32px] [&_.ant-pagination-next]:!h-8 [&_.ant-pagination-next_.ant-pagination-item-link]:!flex [&_.ant-pagination-next_.ant-pagination-item-link]:!items-center [&_.ant-pagination-next_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-next_.ant-pagination-item-link]:!w-full [&_.ant-pagination-next_.ant-pagination-item-link]:!h-full [&_.ant-pagination-next_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-next_.ant-pagination-item-link]:!border [&_.ant-pagination-next_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-item-active]:!bg-[#fafafb] [&_.ant-pagination-item-active]:!border-[#fafafb] [&_.ant-pagination-item-active_a]:!text-[#b0b6bf]">
          <Table<AnnouncementListItem>
            className="flex-1 flex flex-col"
            size="small"
            rowKey="id"
            columns={CentralAnnouncementColumns({
              canPublish,
              publishingId,
              unpublishingId,
              onPublish: ({ id, churchId, version }) =>
                onPublish({ announcementId: id, churchId, version }),
              onUnpublish: ({ id, churchId, version }) =>
                onUnpublish({ announcementId: id, churchId, version }),
              onEdit: (announcement) => setEditor({ mode: 'edit', id: announcement.id }),
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
            pagination={{
              total,
              current: page,
              pageSize,
              showTotal: (total, range) =>
                `Showing ${range[0]} - ${range[1]} of ${total.toLocaleString()} announcements`,
            }}
          />
        </div>
      </div>

      {editor && (
        <ContentsCentralAnnouncementEditor
          announcementId={editor.id}
          mode={editor.mode}
          onClose={() => setEditor(undefined)}
        />
      )}
    </div>
  )
}
