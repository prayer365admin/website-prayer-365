'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Alert, Breadcrumb, ConfigProvider, DatePicker, Select, Table } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import axios from 'axios'

import LayoutIcon from '@/components/common/layout-icon'
import { GivingIcon } from '@/components/icon/giving'
import { EuroIcon } from '@/components/icon/euro'
import { userMgmtTableTheme } from '@/config/antdTheme'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useCentralChurches } from '@/hooks/data/central'
import {
  useAdminDonationSummary,
  useAdminDonationSummaryMonthly,
  useAdminDonationSubscriptions,
  useAdminDonations,
} from '@/hooks/data/donation'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import {
  RecurringColumns,
  donationRowClassName,
  donationTableClass,
  splitMoney,
} from '@/contents/churches/donations/columns'
import {
  DonationDetailModal,
  type DonationDetailPayload,
} from '@/contents/churches/donations/donation-detail-modal'
import type { DonationType } from '@/models/donation'

import { AllDonationsColumns, MonthlySummaryRowsColumns } from './columns'

/** A 403 is the central-scope guard refusing a regional admin: a state, not a retryable error. */
const isForbidden = (error: unknown) => axios.isAxiosError(error) && error.response?.status === 403

const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'monthly-summary', label: 'Monthly Summary' },
] as const

type TabKey = (typeof TABS)[number]['key']

const CURRENCY_NAME: Record<string, string> = { eur: 'Euro', usd: 'US Dollar' }
const currencyName = (currency: string) =>
  CURRENCY_NAME[currency.toLowerCase()] ?? currency.toUpperCase()

const countBadge = (currency: string, count: number) => (
  <span className="rounded bg-[#EDFDF9] px-2 py-0.5 text-[10px] font-medium text-[#067958]">
    {currencyName(currency)} ({count})
  </span>
)

const filterSelectClass =
  '!h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-content]:!text-sm'

/**
 * All-church donations (`/dashboard/donations`). Prayer Donations are gifts to
 * the platform beneficiary (D-01), so every row is classified by its church,
 * never by a stored type. The stat cards aggregate PAID money by `paid_at`
 * (T-05); the Type filter narrows the list only, and only the Monthly Summary
 * tab switches the window to year-to-date.
 */
export default function ContentsDashboardDonations() {
  const permission = useAccessPermission()
  const canRead =
    permission.readAny('prayer_donation').granted || permission.readOwn('prayer_donation').granted

  const [activeTab, setActiveTab] = useState<TabKey>('transactions')
  const [selectedChurchId, setSelectedChurchId] = useState<string | undefined>()
  const [type, setType] = useState<DonationType | undefined>()
  const [currency, setCurrency] = useState<string | undefined>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [detail, setDetail] = useState<DonationDetailPayload | null>(null)
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()

  const { data: churches } = useCentralChurches(canRead)
  const platformChurchId = (churches ?? []).find((c) => c.isPlatform)?.id
  const prayerOnly = type === 'PRAYER'
  const effectiveChurchId = prayerOnly ? platformChurchId : selectedChurchId

  const from = range[0].startOf('day').toISOString()
  const to = range[1].endOf('day').toISOString()

  const {
    data: rows,
    total,
    loading: listLoading,
    error: listError,
  } = useAdminDonations({
    page,
    limit: pageSize,
    orderBy: 'paid_at',
    orderDirection: 'desc',
    from,
    to,
    currency,
    churchId: effectiveChurchId,
    enableFetch: canRead,
  })

  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
  } = useAdminDonationSummary({
    from,
    to,
    churchId: selectedChurchId,
    enableFetch: canRead,
  })

  const {
    data: recurring,
    total: recurringTotal,
    loading: recurringLoading,
    error: recurringError,
  } = useAdminDonationSubscriptions({
    page,
    limit: pageSize,
    currency,
    churchId: effectiveChurchId,
    enableFetch: canRead && activeTab === 'recurring',
  })

  const {
    data: monthly,
    loading: monthlyLoading,
    error: monthlyError,
  } = useAdminDonationSummaryMonthly({
    from: range[0].startOf('year').toISOString(),
    to,
    churchId: selectedChurchId,
    enableFetch: canRead && activeTab === 'monthly-summary',
  })

  if (!canRead) {
    return <RestrictedNotice description="You do not have permission to view donations." />
  }

  // A regional admin reaches the page through the sidebar gate but the server
  // refuses the read; show the restricted state instead of an error loop.
  if (isForbidden(listError) || isForbidden(summaryError)) {
    return (
      <RestrictedNotice description="This page is only available for platform administrators." />
    )
  }

  const currencies = summary?.currencies ?? []
  const currencyOptions = Array.from(
    new Set([
      ...currencies.map((c) => c.currency),
      ...rows.map((r) => r.currency),
      ...recurring.map((r) => r.currency),
    ]),
  )
    .filter(Boolean)
    .sort()
    .map((c) => ({ value: c, label: currencyName(c) }))

  const visibleRows = type ? rows.filter((r) => r.type === type) : rows
  const donationCount = currencies.reduce((sum, c) => sum + c.total.count, 0)

  const updateRange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) setRange([dates[0], dates[1]])
    setPage(1)
  }

  const switchTab = (next: TabKey) => {
    setActiveTab(next)
    setPage(1)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Breadcrumb
        className="mb-1 shrink-0 [&_ol]:!flex [&_ol]:!items-center [&_.ant-breadcrumb-item]:!inline-flex [&_.ant-breadcrumb-item]:!items-center [&_.ant-breadcrumb-separator]:!inline-flex [&_.ant-breadcrumb-separator]:!items-center [&_.ant-breadcrumb-link]:!inline-flex [&_.ant-breadcrumb-link]:!items-center [&_.ant-breadcrumb-link]:!text-xs [&_.ant-breadcrumb-link]:!text-neutral-600 [&_.ant-breadcrumb-link_a]:!text-xs [&_.ant-breadcrumb-link_a]:!text-neutral-600 [&_.ant-breadcrumb-separator]:!text-xs [&_.ant-breadcrumb-separator]:!text-neutral-600"
        items={[{ title: <Link href="/dashboard">Home</Link> }, { title: 'Donations' }]}
      />

      <div className="shrink-0">
        <h1 className="font-font_heading text-2xl font-semibold tracking-[-1px] text-[#0E203E]">
          Donations
        </h1>
        <p className="mt-1 text-sm text-[#5C6370]">
          Review provider-confirmed transactions, recurring donations, and monthly totals.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative rounded-2xl bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <span className="absolute right-4 top-4 text-primary-500">
            <GivingIcon className="text-[20px]" />
          </span>
          <div className="pr-8 text-xs font-medium text-[#5C6370]">Confirmed donations amount</div>
          <div className="mt-3 flex flex-col gap-2">
            {summaryLoading ? (
              <div className="text-2xl text-[#5C6370]">Loading…</div>
            ) : currencies.length === 0 ? (
              <div className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
                € 0<span className="text-xs font-normal text-[#5C6370]">.00</span>
              </div>
            ) : (
              currencies.map((c) => {
                const { major, minor } = splitMoney(c.total.netMinor, c.currency)
                return (
                  <div key={c.currency} className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1">
                      <EuroIcon className="!text-[20px] !text-primary-500" />
                      <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
                        {major}
                      </span>
                      <span className="text-xs text-[#5C6370]">.{minor}</span>
                    </div>
                    {countBadge(c.currency, c.total.count)}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="relative rounded-2xl bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <span className="absolute right-4 top-4 text-[#77B4F2]">
            <LayoutIcon name="calendar" size={20} />
          </span>
          <div className="pr-8 text-xs font-medium text-[#5C6370]">Donation Count</div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
              {summaryLoading ? '—' : donationCount.toLocaleString()}
            </span>
            <span className="flex flex-wrap justify-end gap-1">
              {currencies
                .filter((c) => c.total.count > 0)
                .map((c) => (
                  <span key={c.currency}>{countBadge(c.currency, c.total.count)}</span>
                ))}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] lg:min-h-0 lg:flex-1">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#DDE0E4] px-6 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-500 text-white">
            <GivingIcon className="text-[20px]" />
          </div>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Filter by Church"
            disabled={prayerOnly}
            value={selectedChurchId}
            onChange={(value) => {
              setSelectedChurchId(value)
              setPage(1)
            }}
            options={(churches ?? [])
              .filter((c) => c.isPlatform !== true)
              .map((church) => ({ value: church.id, label: church.name }))}
            className={`w-[280px] ${filterSelectClass}`}
          />
          <Select
            allowClear
            placeholder="Filter by Type"
            value={type}
            onChange={(value) => {
              setType(value as DonationType | undefined)
              setPage(1)
            }}
            options={[
              { value: 'CHURCH', label: 'Church Donation' },
              { value: 'PRAYER', label: 'Prayer Donation' },
            ]}
            className={`w-[160px] ${filterSelectClass}`}
          />
          <Select
            allowClear
            placeholder="All Currency"
            value={currency}
            onChange={(value) => {
              setCurrency(value)
              setPage(1)
            }}
            options={currencyOptions}
            className={`w-[140px] ${filterSelectClass}`}
          />
          <DatePicker.RangePicker
            value={range}
            onChange={(dates) => updateRange(dates as [Dayjs | null, Dayjs | null] | null)}
            allowClear={false}
            className="!h-10"
          />
        </div>

        <div className="shrink-0 border-b border-[#DDE0E4] px-6 py-3">
          <div className="flex w-fit gap-1 rounded-xl bg-[#E6EDFB] p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchTab(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  activeTab === tab.key ? 'bg-white text-[#0E203E]' : 'text-[#2555A7]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col px-6 py-4 lg:flex-1 [&_.ant-table-wrapper]:min-w-0 [&_.ant-table-wrapper]:flex-1 [&_.ant-table-wrapper]:flex [&_.ant-table-wrapper]:flex-col [&_.ant-spin]:min-w-0 [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:min-w-0 [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:min-w-0 [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table-container]:min-w-0 [&_.ant-table-content]:min-w-0 [&_.ant-table-pagination]:!mt-auto">
          {activeTab === 'transactions' && (
            <>
              {listError && (
                <Alert title="Failed to load donations" type="error" showIcon className="mb-4" />
              )}
              <ConfigProvider theme={userMgmtTableTheme}>
                <Table
                  className={donationTableClass}
                  rowClassName={donationRowClassName}
                  dataSource={visibleRows}
                  columns={AllDonationsColumns({
                    onOpen: (row) => setDetail({ kind: 'off', row }),
                    startIndex: (page - 1) * pageSize + 1,
                  })}
                  rowKey="id"
                  loading={listLoading}
                  scroll={{ x: 900 }}
                  locale={{ emptyText: 'No donations for this filter.' }}
                  pagination={{
                    current: page,
                    pageSize,
                    total,
                    onChange: (nextPage, nextSize) => {
                      setPage(nextPage)
                      setPageSize(nextSize)
                    },
                  }}
                />
              </ConfigProvider>
            </>
          )}

          {activeTab === 'recurring' && (
            <>
              {recurringError && (
                <Alert
                  title="Failed to load recurring donations"
                  type="error"
                  showIcon
                  className="mb-4"
                />
              )}
              <ConfigProvider theme={userMgmtTableTheme}>
                <Table
                  className={donationTableClass}
                  rowClassName={donationRowClassName}
                  dataSource={recurring}
                  columns={RecurringColumns({
                    onOpen: (row) => setDetail({ kind: 'recurring', row }),
                    startIndex: (page - 1) * pageSize + 1,
                  })}
                  rowKey="id"
                  loading={recurringLoading}
                  scroll={{ x: 900 }}
                  locale={{ emptyText: 'No recurring donations for this filter.' }}
                  pagination={{
                    current: page,
                    pageSize,
                    total: recurringTotal,
                    onChange: (nextPage, nextSize) => {
                      setPage(nextPage)
                      setPageSize(nextSize)
                    },
                  }}
                />
              </ConfigProvider>
            </>
          )}

          {activeTab === 'monthly-summary' && (
            <>
              {monthlyError && (
                <Alert title="Failed to load summary" type="error" showIcon className="mb-4" />
              )}
              <ConfigProvider theme={userMgmtTableTheme}>
                <Table
                  className={donationTableClass}
                  rowClassName={donationRowClassName}
                  dataSource={monthly}
                  columns={MonthlySummaryRowsColumns({ rows: monthly })}
                  rowKey={(record) => `${record.month}-${record.currency}`}
                  loading={monthlyLoading}
                  locale={{ emptyText: 'No donations in this period.' }}
                  pagination={false}
                />
              </ConfigProvider>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 text-sm text-gray-500">
        Amounts are provider-confirmed and each currency is kept separate; refunds are managed in
        Stripe.
      </div>

      <DonationDetailModal donation={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

function RestrictedNotice({ description }: { description: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="font-font_heading text-2xl font-semibold tracking-[-1px] text-[#0E203E]">
          Donations
        </h1>
        <p className="mt-1 text-sm text-[#5C6370]">
          Review provider-confirmed transactions, recurring donations, and monthly totals.
        </p>
      </div>
      <Alert title="Access restricted" description={description} type="warning" showIcon />
    </div>
  )
}
