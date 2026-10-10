import { TableProps, Tag } from 'antd'
import dayjs from 'dayjs'
import { DonationRow, DonationSubscriptionRow, DonationSummaryRow } from '@/models/donation'

export const formatMinorToMajor = (
  amountMinor: string | number | bigint,
  currency: string,
): string => {
  const amountStr = amountMinor.toString()
  const isNegative = amountStr.startsWith('-')
  const absAmountStr = isNegative ? amountStr.slice(1) : amountStr

  const paddedAmount = absAmountStr.padStart(3, '0')
  const major = paddedAmount.slice(0, -2)
  const minor = paddedAmount.slice(-2)

  const formattedMajor = Number(major).toLocaleString('en-US')
  const formattedAmount = `${formattedMajor}.${minor}`

  return `${isNegative ? '-' : ''}${currency.toUpperCase()} ${formattedAmount}`
}

export const PaymentStateTag = ({ status }: { status?: string | null }) => {
  switch (status?.toLowerCase()) {
    case 'paid':
      return <Tag color="green">Confirmed</Tag>
    case 'failed':
      return <Tag color="red">Failed</Tag>
    case 'refunded':
      return <Tag>Refunded</Tag>
    default:
      return <Tag color="orange">Pending</Tag>
  }
}

export const ProviderStateTag = ({ status }: { status?: string | null }) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return <Tag color="green">Active</Tag>
    case 'past_due':
      return <Tag color="orange">Past due</Tag>
    case 'canceled':
      return <Tag color="red">Canceled</Tag>
    case 'incomplete':
      return <Tag>Incomplete</Tag>
    default:
      return <Tag>{status || 'Unknown'}</Tag>
  }
}

export const TransactionsColumns = (): TableProps<DonationRow>['columns'] => [
  {
    title: 'Date',
    dataIndex: 'paidAt',
    key: 'paidAt',
    render: (paidAt: Date | null, record: DonationRow) => {
      const d = paidAt ?? record.createdAt
      return d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'
    },
  },
  {
    title: 'Reference',
    dataIndex: 'ref',
    key: 'ref',
  },
  {
    title: 'Amount / currency',
    key: 'amount',
    render: (_, record) => formatMinorToMajor(record.amountMinor, record.currency),
  },
  {
    title: 'Payment state',
    key: 'state',
    render: (_, record) => <PaymentStateTag status={record.status} />,
  },
]

export const RecurringColumns = (): TableProps<DonationSubscriptionRow>['columns'] => [
  {
    title: 'Reference',
    dataIndex: 'id',
    key: 'id',
  },
  {
    title: 'Amount / currency',
    key: 'amount',
    render: (_, record) => formatMinorToMajor(record.amountMinor, record.currency),
  },
  {
    title: 'Frequency',
    key: 'frequency',
    render: () => 'Monthly',
  },
  {
    title: 'Provider state',
    dataIndex: 'providerStatus',
    key: 'providerStatus',
    render: (status: string) => <ProviderStateTag status={status} />,
  },
]

export const MonthlySummaryColumns = ({
  monthLabel,
}: {
  monthLabel: string
}): TableProps<DonationSummaryRow>['columns'] => [
  {
    title: 'Month',
    key: 'month',
    render: () => monthLabel,
  },
  {
    title: 'Currency',
    dataIndex: 'currency',
    key: 'currency',
    render: (currency: string) => currency.toUpperCase(),
  },
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
]
