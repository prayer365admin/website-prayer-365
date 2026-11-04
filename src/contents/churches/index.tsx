'use client'

import ChurchAccessNotice from '@/components/container/dashboard/church-scope-guard/access-notice'
import SearchInput from '@/components/common/search-input'
import ChurchStatusTag from '@/contents/central/churches/status'
import { useChurches } from '@/hooks/data/church'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import type { ChurchStatus } from '@prisma/client'
import { Empty, Select } from 'antd'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useEffect, useState } from 'react'

const churchSelectClass =
  'shrink-0 h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selector]:!px-3 [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46] [&_.ant-select-selection-placeholder]:!text-sm [&_.ant-select-selection-placeholder]:!text-[#393E46]'

const STATUS_OPTIONS: ChurchStatus[] = ['APPROVED', 'PENDING', 'SUSPENDED', 'ARCHIVED']

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

export default function ContentsChurches() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const denied = searchParams.get('notice') === 'church_access_denied'
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [searchValue, setSearchValue] = useState<string | undefined>('')
  const [location, setLocation] = useState<string>()
  // Plan 023: the super admin's list covers every lifecycle status, so it needs a
  // marker and a filter instead of an unlabelled mix.
  const [status, setStatus] = useState<string>()

  const {
    data: churches,
    total,
    loading: churchesLoading,
  } = useChurches({
    queryString: ``,
    limit: pageSize,
    page,
    orderBy: 'name',
    orderDirection: 'asc',
    search: searchValue || undefined,
    status,
  })

  useEffect(() => {
    // Never auto-open a church while a filter is active: the single row may be
    // just the filtered result, not the caller's whole scope.
    if (!status && !churchesLoading && total === 1 && churches?.[0]) {
      router.replace(
        `/dashboard/churches/${churches[0].id}${denied ? '?notice=church_access_denied' : ''}`,
      )
    }
  }, [churches, churchesLoading, denied, router, status, total])

  if (!status && total === 1 && churches?.[0]) {
    return null // redirecting to the single church overview
  }

  const locationOptions = Array.from(
    new Set((churches ?? []).map((c) => c.city).filter(Boolean) as string[]),
  ).map((city) => ({ label: city, value: city }))

  const rangeStart = (total ?? 0) === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total ?? 0)

  return (
    <Fragment>
      <ChurchAccessNotice />

      {/* Page Header */}
      <div className="mb-4">
        <h1 className="m-0 text-2xl font-semibold leading-[100%] tracking-[-1px] text-[#0E203E]">
          Choose Church
        </h1>
        <p className="m-0 mt-1 text-sm text-[#5C6370]">Select a church assigned to your account.</p>
      </div>

      {/* Body Card */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
        {/* Search & filter bar */}
        <div className="flex min-h-[73px] items-center gap-2 border-b border-[#DDE0E4] p-4">
          <div className="w-full max-w-[280px] [&_.ant-input-affix-wrapper]:!h-10 [&_.ant-input-affix-wrapper]:!rounded-lg [&_.ant-input-affix-wrapper]:!border-[#DDE0E4] [&_.ant-input]:!text-sm [&_.ant-input::placeholder]:!text-[#0E203E]/45">
            <SearchInput
              placeholder="Search church"
              iconPosition="prefix"
              setValue={setSearchValue}
              setPage={setPage}
              setPageSize={setPageSize}
            />
          </div>
          {/* Figma parity: the churches list API has no country/location filter; selection is visual only. */}
          <Select
            allowClear
            className={`w-[156px] ${churchSelectClass}`}
            placeholder="All Location"
            value={location}
            onChange={setLocation}
            options={locationOptions}
          />
          <Select
            allowClear
            className={`w-[123px] ${churchSelectClass}`}
            placeholder="All status"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={STATUS_OPTIONS.map((val) => ({ value: val, label: val }))}
          />
        </div>

        {/* Table */}
        <div className="flex flex-1 flex-col overflow-x-auto">
          <div className="flex min-w-[720px] flex-col">
            {/* Header row */}
            <div className="flex min-h-[34px] items-stretch bg-[#FAFAFB] px-2 text-xs font-semibold text-[#5C6370]">
              <div className="flex min-w-[180px] flex-[2_1_220px] items-center px-2 py-2">
                Church
              </div>
              <div className="flex min-w-[120px] flex-[1.5_1_180px] items-center px-2 py-2">
                Location
              </div>
              <div className="flex w-[140px] shrink-0 items-center px-2 py-2">Status</div>
              <div className="flex w-[160px] shrink-0 items-center px-2 py-2">Access</div>
              <div className="flex w-[90px] shrink-0 items-center justify-end px-2 py-2">
                Actions
              </div>
            </div>

            {/* Data rows / loading / empty */}
            {churchesLoading ? (
              <div className="flex flex-1 items-center justify-center py-16 text-sm text-[#8F96A3]">
                Loading churches…
              </div>
            ) : !churches?.length ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Empty description="No assigned churches found." />
              </div>
            ) : (
              churches.map((church) => (
                <div
                  key={church.id}
                  className="flex min-h-[57px] items-stretch border-b border-[#DDE0E4] px-2 py-4 last:border-b-0 hover:bg-[#F5F7FF]"
                >
                  <div className="flex min-w-[180px] flex-[2_1_220px] items-center px-2">
                    <span className="truncate text-sm font-semibold text-[#0E203E]">
                      {church.name}
                    </span>
                  </div>
                  <div className="flex min-w-[120px] flex-[1.5_1_180px] items-center px-2">
                    <span className="truncate text-xs text-[#5C6370]">{church.city ?? '-'}</span>
                  </div>
                  <div className="flex w-[140px] shrink-0 items-center px-2">
                    <ChurchStatusTag status={church.status as ChurchStatus} />
                  </div>
                  <div className="flex w-[160px] shrink-0 items-center px-2">
                    <span className="truncate text-xs text-[#8F96A3]">
                      {session?.user?.role?.name ?? '-'}
                    </span>
                  </div>
                  <div className="flex w-[90px] shrink-0 items-center justify-end px-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/churches/${church.id}`)}
                      className="cursor-pointer text-xs font-semibold text-[#2F7AD2] hover:underline"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {/* Pagination footer */}
        <div className="flex min-h-[57px] items-center justify-between gap-4 border-t border-[#F2F3FF] px-4 py-3">
          <span className="text-xs font-normal text-[#8F96A3]">
            {`Showing ${rangeStart} - ${rangeEnd} of ${(total ?? 0).toLocaleString()} churches`}
          </span>
          <SimplePagination page={page} pageSize={pageSize} total={total ?? 0} setPage={setPage} />
        </div>
      </div>
    </Fragment>
  )
}
