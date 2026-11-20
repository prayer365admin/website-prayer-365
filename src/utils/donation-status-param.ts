import { GeneralError } from '@/utils/general-error'
import { DonationLedgerStatusSchema, type DonationLedgerStatus } from '@/models/donation'

/**
 * Optional `?status=` for the admin donation lists. The ledger only ever holds
 * the three provider-confirmed states, so anything else is a client bug and gets
 * a 400 instead of silently returning an unfiltered list.
 */
export const parseDonationLedgerStatus = (
  searchParams: URLSearchParams,
): DonationLedgerStatus | undefined => {
  const raw = searchParams.get('status')
  if (!raw) return undefined
  const parsed = DonationLedgerStatusSchema.safeParse(raw)
  if (!parsed.success) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_STATUS',
      details: `'status' must be one of: ${DonationLedgerStatusSchema.options.join(', ')}.`,
    })
  }
  return parsed.data
}
