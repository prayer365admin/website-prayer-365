'use client'

import { useMemo, useState } from 'react'
import { Alert, ConfigProvider, DatePicker, Select, Table } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import { TabStrip } from '@/components/common/tab-strip'
import LayoutIcon from '@/components/common/layout-icon'
import { GivingIcon } from '@/components/icon/giving'
import { EuroIcon } from '@/components/icon/euro'
import { userMgmtTableTheme } from '@/config/antdTheme'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useDonations, useDonationSubscriptions, useDonationSummary } from '@/hooks/data/donation'
import { useDonationFilters } from '@/hooks/ui/donation-filters'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import type { DonationLedgerStatus } from '@/models/donation'

import {
  MonthlySummaryColumns,
  RecurringColumns,
  TransactionsColumns,
  donationRowClassName,
  donationTableClass,
  splitMoney,
} from './columns'
import { DonationDetailModal, type DonationDetailPayload } from './donation-detail-modal'
import { LedgerStatusSelect } from './status-filter'

const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'summary', label: 'Monthly Summary' },
] as const

type TabKey = (typeof TABS)[number]['key']

const CURRENCY_NAME: Record<string, string> = { eur: 'Euro', usd: 'US Dollar' }
const currencyName = (currency: string) =>
  CURRENCY_NAME[currency.toLowerCase()] ?? currency.toUpperCase()

const countBadge = (currency: string, count: number) => (
  <span className="rounded bg-[var(--color-donation-success-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-donation-success-strong)]">
    {currencyName(currency)} ({count})
  </span>
)

const filterSelectClass =
  '!h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[var(--color-neutral-200)] [&_.ant-select-content]:!text-sm'

/**
 * One church's giving ledger. Transactions and recurring plans share the detail
 * modal with the central page; the Monthly Summary tab keeps its month-picker
 * semantics (a per-currency breakdown of the chosen month), which is different
 * from the central page's cross-month table.
 */
export default function ContentsChurchDonations({ churchId }: { churchId: string }) {
  const permission = useAccessPermission()
  const canRead =
    permission.readAny('prayer_donation').granted || permission.readOwn('prayer_donation').granted

  // Filters live in the URL (T6), so a shared link keeps the month, currency and status.
  const { filters, setFilters } = useDonationFilters({
    tab: 'transactions',
    month: dayjs().format('YYYY-MM'),
  })
  const activeTab = (filters.tab ?? 'transactions') as TabKey
  const selectedMonth = dayjs(filters.month ?? undefined)
  const selectedCurrency = filters.currency
  // Ledger state filter: transactions only. The Monthly summary tab stays
  // PAID-based (T-05), so this Select never widens or narrows those numbers.
  const selectedStatus = filters.status as DonationLedgerStatus | undefined
  const customRange: [Dayjs | null, Dayjs | null] | null =
    filters.from && filters.to ? [dayjs(filters.from), dayjs(filters.to)] : null
  const [detail, setDetail] = useState<DonationDetailPayload | null>(null)

  const {
    page: txPage,
    pageSize: txPageSize,
    setPage: setTxPage,
    setPageSize: setTxPageSize,
  } = useUrlPagination({ pageParam: 'transactions_page', pageSizeParam: 'transactions_limit' })
  const {
    page: recPage,
    pageSize: recPageSize,
    setPage: setRecPage,
    setPageSize: setRecPageSize,
  } = useUrlPagination({ pageParam: 'recurring_page', pageSizeParam: 'recurring_limit' })

  // Derive dates
  let from: string | undefined
  let to: string | undefined
  if (customRange && customRange[0] && customRange[1]) {
    from = customRange[0].startOf('day').toISOString()
    to = customRange[1].endOf('day').toISOString()
  } else {
    from = selectedMonth.startOf('month').toISOString()
    to = selectedMonth.endOf('month').toISOString()
  }

  const {
    data: txData,
    total: txTotal,
    loading: txLoading,
    error: txError,
  } = useDonations({
    churchId,
    page: txPage,
    limit: txPageSize,
    orderBy: 'paid_at',
    orderDirection: 'desc',
    from,
    to,
    currency: selectedCurrency,
    status: selectedStatus,
    enableFetch: canRead,
  })

  const {
    data: recData,
    total: recTotal,
    loading: recLoading,
    error: recError,
  } = useDonationSubscriptions({
    churchId,
    page: recPage,
    limit: recPageSize,
    orderBy: 'created_at',
    orderDirection: 'desc',
    currency: selectedCurrency,
    enableFetch: canRead && activeTab === 'recurring',
  })

  const {
    data: summaryData,
    loading: summaryLoading,
    error: summaryError,
  } = useDonationSummary({
    churchId,
    month: selectedMonth.format('YYYY-MM'),
    enableFetch: canRead,
  })

  const uniqueCurrencies = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(summaryData?.currencies.map((c) => c.currency) ?? []),
            ...txData.map((t) => t.currency),
            ...recData.map((r) => r.currency),
          ].filter(Boolean),
        ),
      ).sort(),
    [summaryData, txData, recData],
  )

  if (!canRead) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <DashboardMainHeader
          title="Donations"
          description="Review provider-confirmed transactions, recurring donations, and monthly totals."
        />
        <Alert
          title="Access restricted"
          description="You do not have permission to view donations."
          type="warning"
          showIcon
        />
      </div>
    )
  }

  const handleCurrencyChange = (val: string) => {
    setFilters({ currency: val })
    setTxPage(1)
    setRecPage(1)
  }

  const handleMonthChange = (date: Dayjs | null) => {
    setFilters({ month: date ? date.format('YYYY-MM') : undefined, from: undefined, to: undefined })
    setTxPage(1)
  }

  const switchTab = (next: TabKey) => {
    setFilters({ tab: next, from: undefined, to: undefined })
    setTxPage(1)
    setRecPage(1)
  }

  // Server already filters transactions/recurring by the selected currency; the
  // summary endpoint is per-currency by construction, so filter its rows only.
  const displayCurrencies = summaryData?.currencies ?? []
  const filteredSummaryData = selectedCurrency
    ? displayCurrencies.filter((c) => c.currency === selectedCurrency)
    : displayCurrencies

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DashboardMainHeader
        title="Donations"
        description="Review provider-confirmed transactions, recurring donations, and monthly totals."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative rounded-2xl bg-white p-4 shadow-[0px_1px_2px_var(--color-donation-card-shadow)]">
          <span className="absolute right-4 top-4 text-primary-500">
            <GivingIcon className="text-[20px]" />
          </span>
          <div className="pr-8 text-xs font-medium text-[var(--color-donation-body)]">
            Confirmed donations amount
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {summaryLoading ? (
              <div className="text-2xl text-[var(--color-donation-body)]">Loading…</div>
            ) : filteredSummaryData.length === 0 ? (
              <div className="text-[32px] font-bold leading-none tracking-[-1px] text-[var(--color-donation-ink)]">
                € 0
                <span className="text-xs font-normal text-[var(--color-donation-body)]">.00</span>
              </div>
            ) : (
              filteredSummaryData.map((c) => {
                const { major, minor } = splitMoney(c.netMinor, c.currency)
                return (
                  <div key={c.currency} className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1">
                      <EuroIcon className="!text-[20px] !text-primary-500" />
                      <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[var(--color-donation-ink)]">
                        {major}
                      </span>
                      <span className="text-xs text-[var(--color-donation-body)]">.{minor}</span>
                    </div>
                    {countBadge(c.currency, c.count)}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="relative rounded-2xl bg-white p-4 shadow-[0px_1px_2px_var(--color-donation-card-shadow)]">
          <span className="absolute right-4 top-4 text-[var(--color-primary-300)]">
            <LayoutIcon name="calendar" size={20} />
          </span>
          <div className="pr-8 text-xs font-medium text-[var(--color-donation-body)]">
            Donation Count
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[var(--color-donation-ink)]">
              {txLoading ? '—' : txTotal.toLocaleString()}
            </span>
            <span className="flex flex-wrap justify-end gap-1">
              {filteredSummaryData
                .filter((c) => c.count > 0)
                .map((c) => (
                  <span key={c.currency}>{countBadge(c.currency, c.count)}</span>
                ))}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0px_1px_2px_var(--color-donation-card-shadow)] lg:min-h-0 lg:flex-1">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-neutral-200)] px-6 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-500 text-white">
            <GivingIcon className="text-[20px]" />
          </div>
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            allowClear={false}
            className="!h-10"
          />
          {activeTab === 'transactions' && (
            <DatePicker.RangePicker
              value={customRange as [Dayjs, Dayjs] | null}
              onChange={(dates) => {
                setFilters({
                  from: dates?.[0] ? dates[0].format('YYYY-MM-DD') : undefined,
                  to: dates?.[1] ? dates[1].format('YYYY-MM-DD') : undefined,
                })
                setTxPage(1)
              }}
              className="!h-10"
            />
          )}
          <Select
            allowClear
            placeholder="All Currency"
            value={selectedCurrency}
            onChange={handleCurrencyChange}
            options={uniqueCurrencies.map((c) => ({ label: currencyName(c), value: c }))}
            className={`w-[140px] ${filterSelectClass}`}
          />
          {/* Transactions only: the Monthly summary tab stays PAID-based (T-05). */}
          <LedgerStatusSelect
            value={selectedStatus}
            onChange={(value) => {
              setFilters({ status: value })
              setTxPage(1)
            }}
          />
        </div>

        <div className="shrink-0 border-b border-[var(--color-neutral-200)] px-6 py-3">
          <TabStrip items={TABS} value={activeTab} onChange={switchTab} label="Donation views" />
        </div>

        <div className="flex min-w-0 flex-col px-6 py-4 lg:flex-1 [&_.ant-table-wrapper]:min-w-0 [&_.ant-table-wrapper]:flex-1 [&_.ant-table-wrapper]:flex [&_.ant-table-wrapper]:flex-col [&_.ant-spin]:min-w-0 [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:min-w-0 [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:min-w-0 [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table-container]:min-w-0 [&_.ant-table-content]:min-w-0 [&_.ant-table-pagination]:!mt-auto">
          {activeTab === 'transactions' && (
            <>
              {txError && (
                <Alert title="Failed to load transactions" type="error" showIcon className="mb-4" />
              )}
              <ConfigProvider theme={userMgmtTableTheme}>
                <Table
                  className={donationTableClass}
                  rowClassName={donationRowClassName}
                  dataSource={txData}
                  columns={TransactionsColumns({
                    onOpen: (row) => setDetail({ kind: 'off', row }),
                    startIndex: (txPage - 1) * txPageSize + 1,
                  })}
                  rowKey="id"
                  loading={txLoading}
                  scroll={{ x: 900 }}
                  pagination={{
                    current: txPage,
                    pageSize: txPageSize,
                    total: txTotal,
                    onChange: (page, pageSize) => {
                      setTxPage(page)
                      setTxPageSize(pageSize)
                    },
                  }}
                />
              </ConfigProvider>
            </>
          )}

          {activeTab === 'recurring' && (
            <>
              {recError && (
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
                  dataSource={recData}
                  columns={RecurringColumns({
                    onOpen: (row) => setDetail({ kind: 'recurring', row }),
                    startIndex: (recPage - 1) * recPageSize + 1,
                  })}
                  rowKey="id"
                  loading={recLoading}
                  scroll={{ x: 900 }}
                  pagination={{
                    current: recPage,
                    pageSize: recPageSize,
                    total: recTotal,
                    onChange: (page, pageSize) => {
                      setRecPage(page)
                      setRecPageSize(pageSize)
                    },
                  }}
                />
              </ConfigProvider>
            </>
          )}

          {activeTab === 'summary' && (
            <>
              {summaryError && (
                <Alert title="Failed to load summary" type="error" showIcon className="mb-4" />
              )}
              <ConfigProvider theme={userMgmtTableTheme}>
                <Table
                  className={donationTableClass}
                  rowClassName={donationRowClassName}
                  dataSource={filteredSummaryData}
                  columns={MonthlySummaryColumns({
                    monthLabel: selectedMonth.format('MMMM YYYY'),
                    showCurrency: filteredSummaryData.length > 1,
                  })}
                  rowKey="currency"
                  loading={summaryLoading}
                  pagination={false}
                />
              </ConfigProvider>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 text-sm text-[var(--color-donation-body)]">
        Amounts are provider-confirmed. Currencies are kept separate; refunds and subscription
        editing are managed in Stripe.
      </div>

      <DonationDetailModal donation={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
