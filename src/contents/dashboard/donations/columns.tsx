import { TableProps } from 'antd'
import dayjs from 'dayjs'

import type { AdminDonationRow, MonthlySummaryRow } from '@/models/donation'
import {
  ActionsColumn,
  AmountCell,
  DonorCell,
  PaymentStateTag,
  SerialColumn,
  currencyLabel,
  displayReference,
  formatMinorToMajor,
} from '@/contents/churches/donations/columns'

/**
 * `/dashboard/donations` table. Money formatting, the donor cell and the actions
 * button come from the per-church columns so the two pages cannot disagree on a
 * currency, a guest row or a modal payload. The Church column stays visible
 * because this page defaults to "All churches".
 */
export const AllDonationsColumns = ({
  onOpen,
  startIndex = 1,
}: {
  onOpen: (row: AdminDonationRow) => void
  /** 1-based ordinal of the first row on this page. */
  startIndex?: number
}): TableProps<AdminDonationRow>['columns'] => [
  SerialColumn<AdminDonationRow>(startIndex),
  {
    title: 'Date',
    dataIndex: 'paidAt',
    key: 'paidAt',
    className: 'whitespace-nowrap',
    render: (paidAt: Date | null, record: AdminDonationRow) => {
      const d = paidAt ?? record.createdAt
      return d ? dayjs(d).format('DD MMMM YYYY') : '-'
    },
  },
  {
    title: 'Church',
    dataIndex: 'churchName',
    key: 'churchName',
  },
  {
    title: 'Reference',
    key: 'ref',
    render: (_, record) => <span className="whitespace-nowrap">{displayReference(record.id)}</span>,
  },
  {
    title: 'Amount',
    key: 'amount',
    render: (_, record) => (
      <AmountCell amountMinor={record.amountMinor} currency={record.currency} />
    ),
  },
  {
    title: 'Donor',
    key: 'donor',
    render: (_, record) => <DonorCell donor={record.donor} />,
  },
  {
    title: 'Payment Status',
    key: 'state',
    render: (_, record) => <PaymentStateTag status={record.status} />,
  },
  ActionsColumn<AdminDonationRow>({ onOpen }),
]

/**
 * Monthly Summary tab. The currency column only appears when the page actually
 * mixes currencies — one-currency ledgers read as a single clean table.
 */
export const MonthlySummaryRowsColumns = ({
  rows,
}: {
  rows: MonthlySummaryRow[]
}): TableProps<MonthlySummaryRow>['columns'] => {
  const mixedCurrency = rows.some((r) => r.currency !== rows[0]?.currency)
  const columns: TableProps<MonthlySummaryRow>['columns'] = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      render: (month: string) => dayjs(`${month}-01`).format('MMMM YYYY'),
    },
  ]
  if (mixedCurrency) {
    columns.push({
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      render: (currency: string) => currencyLabel(currency),
    })
  }
  columns.push(
    {
      title: 'Gross paid',
      key: 'gross',
      render: (_, record) => formatMinorToMajor(record.grossMinor, record.currency),
    },
    {
      title: 'Refunded',
      key: 'refunded',
      render: (_, record) => formatMinorToMajor(record.refundedMinor, record.currency),
    },
    {
      title: 'Net total',
      key: 'net',
      render: (_, record) => formatMinorToMajor(record.netMinor, record.currency),
    },
  )
  return columns
}
