import { Button, TableProps } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  type AdminDonationRow,
  DonationSubscriptionRow,
  DonationSummaryRow,
} from '@/models/donation'

import { PaymentStatusPill, ProviderStatusPill } from './status-pill'

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

/** "EUR 15.00" → ["15", "00"] so a card can size the minor part separately. */
export const splitMoney = (
  amountMinor: string | number | bigint,
  currency: string,
): { major: string; minor: string } => {
  const [, value = '0.00'] = formatMinorToMajor(amountMinor, currency).split(' ')
  const [major, minor] = value.split('.')
  return { major, minor }
}

const CURRENCY_LABEL: Record<string, string> = {
  eur: 'Euro (€)',
  usd: 'US Dollar ($)',
}

/** Human currency line under an amount; unknown codes fall back to their ISO code. */
export const currencyLabel = (currency: string): string =>
  CURRENCY_LABEL[currency.toLowerCase()] ?? currency.toUpperCase()

/**
 * Provider payment ids (`pi_…`, `in_…`) are internal plumbing and must not be the
 * user-facing reference. The ledger shows a compact code derived from the record
 * id instead; it stays stable for a given donation and never leaks provider keys.
 */
export const displayReference = (id: string): string =>
  `#${id.replace(/-/g, '').slice(-12).toUpperCase()}`

/**
 * Shared ledger-table skin (both donation pages): 34px grey header, 69px rows,
 * zebra striping, 1px row separators and a 16px-bordered container, per the mock.
 */
export const donationTableClass = [
  '[&_.ant-table]:!w-full [&_.ant-table]:!min-w-0 [&_.ant-table]:!bg-transparent',
  '[&_.ant-table-content>table]:!w-full [&_.ant-table-content>table]:!min-w-[900px] [&_.ant-table-content>table]:!table-fixed',
  '[&_.ant-table-container]:!rounded-2xl [&_.ant-table-container]:!border [&_.ant-table-container]:!border-[#F6F6F6]',
  '[&_.ant-table-thead>tr>th]:!h-[34px] [&_.ant-table-thead>tr>th]:!border-b-0 [&_.ant-table-thead>tr>th]:!bg-[#F6F6F6] [&_.ant-table-thead>tr>th]:!px-2 [&_.ant-table-thead>tr>th]:!py-2 [&_.ant-table-thead>tr>th]:!text-xs [&_.ant-table-thead>tr>th]:!font-semibold [&_.ant-table-thead>tr>th]:!text-[#5C6370]',
  '[&_.ant-table-tbody>tr>td]:!border-b [&_.ant-table-tbody>tr>td]:!border-[#DDE0E4] [&_.ant-table-tbody>tr>td]:!px-2 [&_.ant-table-tbody>tr>td]:!py-4 [&_.ant-table-tbody>tr>td]:!text-xs [&_.ant-table-tbody>tr>td]:!text-[#5C6370]',
  '[&_.ant-table-tbody>tr:last-child>td]:!border-b-0',
  '[&_.ant-table-measure-row]:!hidden',
  '[&_.ant-table-tbody>tr.donation-row--alt>td]:!bg-[#F6F6F6]',
  '[&_.ant-table-tbody>tr:hover>td]:!bg-[#F6F6F6]',
  '[&_.ant-table-pagination]:!px-4',
].join(' ')

/** Alternating row stripes: the mock tints every second row. */
export const donationRowClassName = (_: unknown, index: number) =>
  index % 2 === 1 ? 'donation-row--alt' : ''

/**
 * Two-line money cell from the mock: the major part bold, the currency written
 * out underneath. Splitting the shared formatter keeps rounding/negatives in one
 * place; a failed row still shows its amount.
 */
export const AmountCell = ({
  amountMinor,
  currency,
}: {
  amountMinor: string | number | bigint
  currency: string
}) => {
  const formatted = formatMinorToMajor(amountMinor, currency)
  const value = formatted.split(' ').slice(1).join(' ')
  const [major, minor] = value.split('.')
  return (
    <div className="whitespace-nowrap leading-tight">
      <div className="text-xs font-semibold text-[#22252A]">
        {currency.toUpperCase() === 'EUR' ? '€' : currency.toUpperCase()} {major}
        {minor ? <span className="font-normal text-[#8F96A3]">.{minor}</span> : null}
      </div>
      <div className="text-xs text-[#8F96A3]">{currencyLabel(currency)}</div>
    </div>
  )
}

export const PaymentStateTag = ({ status }: { status?: string | null }) => (
  <PaymentStatusPill status={status} />
)

export const ProviderStateTag = ({ status }: { status?: string | null }) => (
  <ProviderStatusPill status={status} />
)

/**
 * One donor cell for both donation pages (D-06): a registered giver shows name +
 * email, a guest gift shows "Guest" and nothing else. Guest gifts store no
 * contact data, so there is no address to reveal.
 */
export const DonorCell = ({ donor }: { donor: AdminDonationRow['donor'] }) =>
  donor ? (
    <div className="leading-tight">
      <div>{donor.name}</div>
      <div className="text-xs text-gray-500">{donor.email}</div>
    </div>
  ) : (
    'Guest'
  )

/** Leading ordinal column: the mock numbers rows from 1 inside the current page. */
export const SerialColumn = <T,>(
  startIndex: number,
): NonNullable<TableProps<T>['columns']>[number] => ({
  title: '',
  key: 'serial',
  width: 36,
  render: (_, __, index) => (
    <span className="text-xs text-[#5C6370] opacity-50">{startIndex + index}.</span>
  ),
})

/** Trailing eye button (32px, 1px border); every ledger table opens the same modal. */
export const ActionsColumn = <T extends { id: string }>({
  onOpen,
}: {
  onOpen: (row: T) => void
}): NonNullable<TableProps<T>['columns']>[number] => ({
  title: 'Actions',
  key: 'actions',
  width: 84,
  align: 'right',
  render: (_, record: T) => (
    <Button
      aria-label="View donation"
      icon={<EyeOutlined />}
      onClick={() => onOpen(record)}
      className="!grid !h-8 !w-8 !place-items-center !rounded !border !border-[#DDE0E4] !bg-white !p-0 !text-[#B0B6BF] hover:!text-[#5C6370]"
    />
  ),
})

export const TransactionsColumns = ({
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

export const RecurringColumns = ({
  onOpen,
  startIndex = 1,
}: {
  onOpen: (row: DonationSubscriptionRow) => void
  /** 1-based ordinal of the first row on this page. */
  startIndex?: number
}): TableProps<DonationSubscriptionRow>['columns'] => [
  SerialColumn<DonationSubscriptionRow>(startIndex),
  {
    title: 'Reference',
    key: 'id',
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
    title: 'Frequency',
    key: 'frequency',
    render: (_, record) => record.frequency,
  },
  {
    title: 'Provider state',
    dataIndex: 'providerStatus',
    key: 'providerStatus',
    render: (status: string) => <ProviderStateTag status={status} />,
  },
  ActionsColumn<DonationSubscriptionRow>({ onOpen }),
]

export const MonthlySummaryColumns = ({
  monthLabel,
  showCurrency = true,
}: {
  monthLabel: string
  showCurrency?: boolean
}): TableProps<DonationSummaryRow>['columns'] => {
  const columns: TableProps<DonationSummaryRow>['columns'] = [
    {
      title: 'Month',
      key: 'month',
      render: () => monthLabel,
    },
  ]
  if (showCurrency) {
    columns.push({
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      render: (currency: string) => currency.toUpperCase(),
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
