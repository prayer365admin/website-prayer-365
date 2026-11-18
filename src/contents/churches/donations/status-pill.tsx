/**
 * Dot-pill states from the donations mock: 4px/10px padding, pill border, 6px dot,
 * 12px semibold label. Colors are the mock's exact tokens.
 */
export type PillTone = 'success' | 'danger' | 'neutral' | 'warning' | 'info'

const TONE_CLASS: Record<PillTone, string> = {
  success: 'bg-[#EDFDF9] border-[#D3FAEF] text-[#09A97C]',
  danger: 'bg-[#FEF2F2] border-[#FEE2E2] text-[#B91C1C]',
  neutral: 'bg-[#F6F6F6] border-[#DDE0E4] text-[#5C6370]',
  warning: 'bg-[#FFF7E6] border-[#FCE7B2] text-[#B45309]',
  info: 'bg-[#EDF4FF] border-[#D6E4FF] text-[#2555A7]',
}

const TONE_DOT: Record<PillTone, string> = {
  success: '#09A97C',
  danger: '#B91C1C',
  neutral: '#737C8C',
  warning: '#B45309',
  info: '#2F7AD2',
}

export const StatusPill = ({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) => (
  <span
    className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-[18px] ${TONE_CLASS[tone]}`}
  >
    <span
      className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: TONE_DOT[tone] }}
      aria-hidden="true"
    />
    {label}
  </span>
)

const PAYMENT_PILL: Record<string, { label: string; tone: PillTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'warning' },
}

/** Ledger state of a donation row (PAID → "Confirmed"). Unknown states read as Pending. */
export const PaymentStatusPill = ({ status }: { status?: string | null }) => {
  const pill = PAYMENT_PILL[status?.toLowerCase() ?? ''] ?? PAYMENT_PILL.pending
  return <StatusPill label={pill.label} tone={pill.tone} />
}

const PROVIDER_PILL: Record<string, { label: string; tone: PillTone }> = {
  active: { label: 'Active', tone: 'success' },
  paid: { label: 'Paid', tone: 'success' },
  past_due: { label: 'Past due', tone: 'warning' },
  in_review: { label: 'In review', tone: 'info' },
  declined: { label: 'Declined', tone: 'danger' },
  failed: { label: 'Declined', tone: 'danger' },
  canceled: { label: 'Canceled', tone: 'danger' },
  incomplete: { label: 'Incomplete', tone: 'neutral' },
}

/** Recurring-plan state; unknown provider states pass through raw (never invented). */
export const ProviderStatusPill = ({ status }: { status?: string | null }) => {
  const pill = PROVIDER_PILL[status?.toLowerCase() ?? '']
  if (!pill) return <StatusPill label={status || 'Unknown'} />
  return <StatusPill label={pill.label} tone={pill.tone} />
}
