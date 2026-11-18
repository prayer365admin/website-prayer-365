'use client'

import { useMemo, useState } from 'react'
import { Alert, Card, Col, DatePicker, Row, Select, Statistic, Table, Tabs } from 'antd'
import dayjs, { Dayjs } from 'dayjs'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import {
  MonthlySummaryColumns,
  TransactionsColumns,
  formatMinorToMajor,
} from '@/contents/churches/donations/columns'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useDonations, useDonationSummary } from '@/hooks/data/donation'
import { useUrlPagination } from '@/hooks/ui/url-pagination'

/**
 * Platform giving (`/dashboard/central/donations`). Guest gifts from `/give` are
 * attributed to the hidden platform beneficiary, never to a parish, so they are
 * read through the central `prayer_donation` scope instead of a church report.
 * One-time only by design (D-04): there is no recurring tab.
 */
export default function ContentsCentralDonations() {
  const permission = useAccessPermission()
  const canRead =
    permission.readAny('prayer_donation').granted || permission.readOwn('prayer_donation').granted

  const [activeTab, setActiveTab] = useState<'transactions' | 'summary'>('transactions')
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<string | undefined>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()

  // The transactions tab can widen beyond the month; the summary stays monthly.
  let from: string | undefined
  let to: string | undefined
  if (activeTab === 'transactions' && customRange && customRange[0] && customRange[1]) {
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
    platform: true,
    page,
    limit: pageSize,
    orderBy: 'paid_at',
    orderDirection: 'desc',
    from,
    to,
    currency: selectedCurrency,
    enableFetch: canRead,
  })

  const {
    data: summaryData,
    loading: summaryLoading,
    error: summaryError,
  } = useDonationSummary({
    platform: true,
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
          ]
            .filter(Boolean)
            .map((c) => c.toLowerCase()),
        ),
      ).sort(),
    [summaryData, txData],
  )

  if (!canRead) {
    return (
      <div className="flex flex-col gap-4">
        <DashboardMainHeader
          title="Platform giving"
          description="Guest gifts to Prayer 365 itself, read from the payment ledger."
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

  const displayCurrencies = summaryData?.currencies ?? []
  const filteredSummary = selectedCurrency
    ? displayCurrencies.filter((c) => c.currency.toLowerCase() === selectedCurrency)
    : displayCurrencies
  const confirmedContent = filteredSummary.map((c) => (
    <div key={c.currency} className="mb-1">
      {formatMinorToMajor(c.netMinor, c.currency)}
    </div>
  ))

  return (
    <div className="flex flex-col gap-4">
      <DashboardMainHeader
        title="Platform giving"
        description="Guest gifts to Prayer 365 itself. They are not a parish's donations: each row is attributed to the hidden platform beneficiary, so no church report includes them."
      />

      <div className="flex flex-wrap gap-4 items-center">
        <DatePicker
          picker="month"
          value={selectedMonth}
          onChange={(date) => {
            if (date) setSelectedMonth(date)
            setCustomRange(null)
            setPage(1)
          }}
          allowClear={false}
        />
        {activeTab === 'transactions' && (
          <DatePicker.RangePicker
            value={customRange as [Dayjs, Dayjs] | null}
            onChange={(dates) => {
              setCustomRange(dates as [Dayjs | null, Dayjs | null])
              setPage(1)
            }}
          />
        )}
        <Select
          allowClear
          placeholder="Filter by currency"
          value={selectedCurrency}
          onChange={(val) => {
            setSelectedCurrency(val)
            setPage(1)
          }}
          options={uniqueCurrencies.map((c) => ({ label: c.toUpperCase(), value: c }))}
          className="min-w-[120px]"
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card title="Net total" size="small">
            {summaryLoading
              ? 'Loading...'
              : confirmedContent.length > 0
                ? confirmedContent
                : '0.00'}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="Gifts in range" size="small">
            <Statistic value={txTotal} loading={txLoading} />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as typeof activeTab)
          setCustomRange(null)
          setPage(1)
        }}
        items={[
          {
            key: 'transactions',
            label: 'Transactions',
            children: (
              <div>
                {txError && (
                  <Alert
                    title="Failed to load transactions"
                    type="error"
                    showIcon
                    className="mb-4"
                  />
                )}
                <Table
                  dataSource={txData}
                  columns={TransactionsColumns()}
                  rowKey="id"
                  loading={txLoading}
                  pagination={{
                    current: page,
                    pageSize,
                    total: txTotal,
                    onChange: (nextPage, nextSize) => {
                      setPage(nextPage)
                      setPageSize(nextSize)
                    },
                  }}
                />
              </div>
            ),
          },
          {
            key: 'summary',
            label: 'Monthly summary',
            children: (
              <div>
                {summaryError && (
                  <Alert title="Failed to load summary" type="error" showIcon className="mb-4" />
                )}
                <Table
                  dataSource={filteredSummary}
                  columns={MonthlySummaryColumns({ monthLabel: selectedMonth.format('MMMM YYYY') })}
                  rowKey="currency"
                  loading={summaryLoading}
                  pagination={false}
                />
              </div>
            ),
          },
        ]}
      />

      <div className="text-gray-500 text-sm mt-8">
        Amounts are provider-confirmed. A guest gift is one-time and unattributed to an account;
        currencies are kept separate, and refunds are managed in Stripe.
      </div>
    </div>
  )
}
