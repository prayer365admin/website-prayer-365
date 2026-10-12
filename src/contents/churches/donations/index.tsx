'use client'

import { useMemo, useState } from 'react'
import { Alert, Card, Col, DatePicker, Row, Select, Statistic, Table, Tabs } from 'antd'
import dayjs, { Dayjs } from 'dayjs'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useDonations, useDonationSubscriptions, useDonationSummary } from '@/hooks/data/donation'

import {
  MonthlySummaryColumns,
  RecurringColumns,
  TransactionsColumns,
  formatMinorToMajor,
} from './columns'

export default function ContentsChurchDonations({ churchId }: { churchId: string }) {
  const permission = useAccessPermission()
  const canRead =
    permission.readAny('prayer_donation').granted || permission.readOwn('prayer_donation').granted

  const [activeTab, setActiveTab] = useState<'transactions' | 'recurring' | 'summary'>(
    'transactions',
  )
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<string | undefined>()

  const [txPage, setTxPage] = useState(1)
  const [txPageSize, setTxPageSize] = useState(10)

  const [recPage, setRecPage] = useState(1)
  const [recPageSize, setRecPageSize] = useState(10)

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
    enableFetch: canRead,
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
      <div className="flex flex-col gap-4">
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
    setSelectedCurrency(val)
    setTxPage(1)
    setRecPage(1)
  }

  // Server already filters transactions/recurring by the selected currency; the
  // summary endpoint is per-currency by construction, so filter its rows only.
  // The confirmed amount card and summary table both follow the currency filter.
  const displayCurrencies = summaryData?.currencies ?? []
  const filteredSummaryData = selectedCurrency
    ? displayCurrencies.filter((c) => c.currency === selectedCurrency)
    : displayCurrencies
  const confirmedContent = filteredSummaryData.map((c) => (
    <div key={c.currency} className="mb-1">
      {formatMinorToMajor(c.netMinor, c.currency)}
    </div>
  ))

  return (
    <div className="flex flex-col gap-4">
      <DashboardMainHeader
        title="Donations"
        description="Review provider-confirmed transactions, recurring donations, and monthly totals."
      />

      <div className="flex flex-wrap gap-4 items-center">
        <DatePicker
          picker="month"
          value={selectedMonth}
          onChange={(date) => {
            if (date) setSelectedMonth(date)
            setCustomRange(null)
          }}
          allowClear={false}
        />
        {activeTab === 'transactions' && (
          <DatePicker.RangePicker
            value={customRange as [Dayjs, Dayjs] | null}
            onChange={(dates) => {
              setCustomRange(dates as [Dayjs | null, Dayjs | null])
            }}
          />
        )}
        <Select
          allowClear
          placeholder="Filter by currency"
          value={selectedCurrency}
          onChange={handleCurrencyChange}
          options={uniqueCurrencies.map((c) => ({ label: c.toUpperCase(), value: c }))}
          className="min-w-[120px]"
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card title="Confirmed amount" size="small">
            {summaryLoading
              ? 'Loading...'
              : confirmedContent.length > 0
                ? confirmedContent
                : '0.00'}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="Donation count" size="small">
            <Statistic value={txTotal} loading={txLoading} />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          const nextTab = key as typeof activeTab
          setActiveTab(nextTab)
          if (nextTab !== 'transactions') {
            setCustomRange(null)
          }
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
                    current: txPage,
                    pageSize: txPageSize,
                    total: txTotal,
                    onChange: (page, pageSize) => {
                      setTxPage(page)
                      setTxPageSize(pageSize)
                    },
                  }}
                />
              </div>
            ),
          },
          {
            key: 'recurring',
            label: 'Recurring',
            children: (
              <div>
                {recError && (
                  <Alert
                    title="Failed to load recurring donations"
                    type="error"
                    showIcon
                    className="mb-4"
                  />
                )}
                <Table
                  dataSource={recData}
                  columns={RecurringColumns()}
                  rowKey="id"
                  loading={recLoading}
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
                  dataSource={filteredSummaryData}
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
        Amounts are provider-confirmed. Currencies are kept separate; refunds and subscription
        editing are managed in Stripe.
      </div>
    </div>
  )
}
