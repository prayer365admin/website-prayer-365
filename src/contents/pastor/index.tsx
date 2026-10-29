'use client'

import AddButton from '@/components/common/add-button'
import PastorImage from '@/components/common/pastor-image'
import SearchInput from '@/components/common/search-input'
import { userMgmtTableTheme } from '@/config/antdTheme'
import { ChurchIcon } from '@/components/icon/church'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useCentralChurches, usePastorStaffOptions, usePastors } from '@/hooks/data/central'
import { useConfirmModal } from '@/hooks/ui/confirm-modal'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { PastorData } from '@/models/pastor'
import { DeleteFilled, EditFilled } from '@ant-design/icons'
import { Alert, ConfigProvider, Select, Tooltip } from 'antd'
import { useState } from 'react'
import PastorDrawer from './drawer'

const churchSelectClass =
  'shrink-0 h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selector]:!px-3 [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46] [&_.ant-select-selection-placeholder]:!text-sm [&_.ant-select-selection-placeholder]:!text-[#393E46]'

export default function ContentsPastor() {
  const [searchValue, setSearchValue] = useState<string | undefined>('')
  const sort = { orderBy: 'name', orderDirection: 'asc' } as const
  const [churchId, setChurchId] = useState<string | undefined>()
  const [accountId, setAccountId] = useState<string | undefined>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: churches, isLoading: churchesLoading } = useCentralChurches()
  const staffQuery = usePastorStaffOptions(true, { pastorLinked: true })

  const churchOptions = (churches ?? []).map((church) => ({
    label: church.name,
    value: church.id,
  }))
  const accountOptions = (staffQuery.data ?? []).map((user) => ({
    label: `${user.name} (${user.email})`,
    value: user.id,
  }))

  const { data, total, loading, error, onDelete } = usePastors({
    search: searchValue,
    orderDirection: sort.orderDirection,
    orderBy: sort.orderBy as 'name' | 'introduction' | 'staff_account' | 'churches',
    churchId,
    userId: accountId,
    limit: pageSize,
    page,
  })

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total ?? 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Simplified page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold leading-tight tracking-tight text-[#0E203E]">
            Pastors
          </h1>
          <p className="m-0 text-sm font-normal leading-normal text-[#5C6370]">
            Prayers from every church. Open one to review, publish or manage its audio.
          </p>
        </div>
        <div className="shrink-0">
          <AddButton
            label="New Pastor"
            onClick={() => setCreating(true)}
            permissionSubject="prayer_pastor"
          />
        </div>
      </div>

      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title="Pastor profiles could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      {/* Body card */}
      <ConfigProvider theme={userMgmtTableTheme}>
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          {/* Search & filter bar */}
          <div className="flex min-h-[73px] items-center gap-2 border-b border-[#DDE0E4] p-4">
            <div className="w-full max-w-[280px] [&_.ant-input-affix-wrapper]:!h-10 [&_.ant-input-affix-wrapper]:!rounded-lg [&_.ant-input-affix-wrapper]:!border-[#DDE0E4] [&_.ant-input]:!text-sm [&_.ant-input::placeholder]:!text-[#0E203E]/45">
              <SearchInput
                placeholder="Search Pastor"
                iconPosition="prefix"
                setValue={setSearchValue}
                setPage={setPage}
                setPageSize={setPageSize}
              />
            </div>
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              className={`w-[200px] ${churchSelectClass}`}
              placeholder="All Church"
              loading={churchesLoading}
              value={churchId}
              onChange={(value) => {
                setChurchId(value)
                setPage(1)
              }}
              options={churchOptions}
            />
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              className={`w-[220px] ${churchSelectClass}`}
              placeholder="All Account"
              loading={staffQuery.isLoading}
              value={accountId}
              onChange={(value) => {
                setAccountId(value)
                setPage(1)
              }}
              options={accountOptions}
            />
          </div>

          {/* Table */}
          <div className="flex flex-1 flex-col">
            {/* Header row */}
            <div className="flex min-h-[34px] items-stretch bg-[#FAFAFB] px-2 text-xs font-semibold text-[#5C6370]">
              <div className="flex min-w-0 max-w-[320px] flex-[1_1_320px] items-center px-2 py-2">
                Name (church)
              </div>
              <div className="flex min-w-0 flex-[2_1_400px] items-center px-2 py-2">
                Introduction
              </div>
              <div className="hidden min-w-0 max-w-[220px] flex-[1_1_220px] items-center px-2 py-2 md:flex">
                Staff account
              </div>
              <div className="flex min-w-[120px] items-center justify-end px-2 py-2">Actions</div>
            </div>

            {/* Data rows */}
            <PastorRows
              data={data ?? []}
              loading={loading}
              onEdit={(id) => setEditingId(id)}
              onDelete={onDelete}
            />
          </div>

          {/* Pagination footer */}
          <div className="flex min-h-[57px] items-center justify-between gap-4 border-t border-[#F2F3FF] px-4 py-3">
            <span className="text-xs font-normal text-[#8F96A3]">
              {`Showing ${rangeStart} - ${rangeEnd} of ${(total ?? 0).toLocaleString()} pastors`}
            </span>
            <SimplePagination
              page={page}
              pageSize={pageSize}
              total={total ?? 0}
              setPage={setPage}
            />
          </div>
        </div>
      </ConfigProvider>

      {creating && <PastorDrawer onClose={() => setCreating(false)} />}

      {editingId && <PastorDrawer pastorId={editingId} onClose={() => setEditingId(null)} />}
    </div>
  )
}

function PastorRows({
  data,
  loading,
  onEdit,
  onDelete,
}: {
  data: PastorData[]
  loading: boolean
  onEdit: (id: string) => void
  onDelete: (pastorId: string) => void
}) {
  const permission = useAccessPermission()
  const canDelete =
    permission.deleteAny('prayer_pastor').granted || permission.deleteOwn('prayer_pastor').granted

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-[#8F96A3]">
        Loading pastors…
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-[#8F96A3]">
        No pastors found.
      </div>
    )
  }

  return (
    <>
      {data.map((pastor) => (
        <PastorRowItem
          key={pastor.id}
          pastor={pastor}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

function PastorRowItem({
  pastor,
  canDelete,
  onEdit,
  onDelete,
}: {
  pastor: PastorData
  canDelete: boolean
  onEdit: (id: string) => void
  onDelete: (pastorId: string) => void
}) {
  const deleteModal = useConfirmModal({
    entity: 'pastor',
    actions: 'deleting',
    details: pastor.name,
    onOk: () => onDelete(pastor.id),
  })

  return (
    <div className="flex items-stretch border-b border-[#DDE0E4] px-2 last:border-b-0 hover:bg-[#F5F7FF]">
      {/* Name (church) */}
      <div className="flex min-w-0 max-w-[320px] flex-[1_1_320px] items-center gap-2 overflow-hidden px-2 py-4">
        <PastorImage
          imageAssetId={pastor.imageAssetId}
          churchId={pastor.imageChurchId}
          name={pastor.name}
          size={40}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-[21px] text-[#0E203E]">
            {pastor.name}
          </div>
          <div className="flex items-center gap-1.5 text-xs leading-[18px] text-[#5C6370]">
            <ChurchIcon className="text-[#B0B6BF]" />
            <span className="truncate">
              {pastor.churches.length
                ? pastor.churches.map((church) => church.churchName).join(', ')
                : 'No church'}
            </span>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="flex min-w-0 flex-[2_1_400px] items-center overflow-hidden px-2 py-4">
        <span
          className="line-clamp-2 text-xs leading-[18px] text-[#5C6370]"
          title={pastor.introduction ?? undefined}
        >
          {pastor.introduction ?? '—'}
        </span>
      </div>

      {/* Staff account */}
      <div className="hidden min-w-0 max-w-[220px] flex-[1_1_220px] flex-col justify-center gap-1 px-2 py-4 md:flex">
        {pastor.user ? (
          <>
            <div className="truncate text-xs font-normal leading-[18px] text-[#0E203E]">
              {pastor.user.name}
            </div>
            <div className="truncate text-xs font-normal leading-[18px] text-[#5C6370]">
              {pastor.user.email}
            </div>
          </>
        ) : (
          <span className="self-start rounded bg-[#F5F7FF] px-1.5 py-0.5 text-[10px] font-medium leading-[15px] text-[#2555A7]">
            Not linked
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex min-w-[120px] items-center justify-end gap-2 px-2 py-4">
        <Tooltip title="Edit">
          <button
            type="button"
            aria-label={`Edit ${pastor.name}`}
            onClick={() => onEdit(pastor.id)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-[#DDE0E4] bg-white text-[#B0B6BF] hover:border-[#2F7AD2] hover:text-[#2F7AD2]"
          >
            <EditFilled style={{ fontSize: 10 }} />
          </button>
        </Tooltip>
        {canDelete && (
          <Tooltip title="Delete">
            <button
              type="button"
              aria-label={`Delete ${pastor.name}`}
              onClick={deleteModal}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-[#E64C4C] bg-[#E64C4C] text-white hover:opacity-90"
            >
              <DeleteFilled style={{ fontSize: 10 }} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

function SimplePagination({
  page,
  pageSize,
  total,
  setPage,
}: {
  page: number
  pageSize: number
  total: number
  setPage: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (pageCount <= 1) return null

  const pages: Array<number | '...'> = []
  if (pageCount <= 5) {
    for (let i = 1; i <= pageCount; i++) pages.push(i)
  } else {
    const windowStart = Math.max(1, Math.min(page - 1, pageCount - 3))
    const windowEnd = Math.min(pageCount, windowStart + 2)
    if (windowStart > 1) pages.push(1)
    if (windowStart > 2) pages.push('...')
    for (let i = windowStart; i <= windowEnd; i++) pages.push(i)
    if (windowEnd < pageCount - 1) pages.push('...')
    if (windowEnd < pageCount) pages.push(pageCount)
  }

  const base =
    'flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border px-2 text-xs font-semibold'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
        className={`${base} border-[#DDE0E4] bg-white text-[#5C6370] disabled:cursor-not-allowed disabled:text-[#DDE0E4]`}
      >
        ‹
      </button>
      {pages.map((p, index) =>
        p === '...' ? (
          <span key={`ellipsis-${index}`} className="px-1 text-xs text-[#B0B6BF]">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => setPage(p)}
            className={
              p === page
                ? `${base} border-[#FAFAFB] bg-[#FAFAFB] text-[#B0B6BF]`
                : `${base} border-[#DDE0E4] bg-white text-[#5C6370]`
            }
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => setPage(page + 1)}
        className={`${base} border-[#DDE0E4] bg-white text-[#5C6370] disabled:cursor-not-allowed disabled:text-[#DDE0E4]`}
      >
        ›
      </button>
    </div>
  )
}
