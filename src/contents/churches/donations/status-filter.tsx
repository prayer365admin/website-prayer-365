import { Select } from 'antd'
import type { DonationLedgerStatus } from '@/models/donation'

/** The three states the ledger writer produces (PAID / FAILED / REFUNDED), in UI wording. */
export const LEDGER_STATUS_OPTIONS: Array<{ value: DonationLedgerStatus; label: string }> = [
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
]

/**
 * One status filter shared by the all-church and per-church donation pages, so
 * the wording and the accepted values cannot drift apart.
 */
export const LedgerStatusSelect = ({
  value,
  onChange,
}: {
  value?: DonationLedgerStatus
  onChange: (value?: DonationLedgerStatus) => void
}) => (
  <Select
    allowClear
    placeholder="All statuses"
    value={value}
    onChange={(next) => onChange(next as DonationLedgerStatus | undefined)}
    options={LEDGER_STATUS_OPTIONS}
    className="min-w-[160px]"
  />
)
