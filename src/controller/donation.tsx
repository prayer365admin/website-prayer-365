import { STRIPE } from '@/providers/stripe'
import { withExternalIdempotency } from '@/utils/idempotency'
import { validate } from '@/utils/validate'
import { GeneralError } from '@/utils/general-error'
import {
  GET_DONATIONS,
  GET_DONATION_SUBSCRIPTIONS,
  GET_DONATION_SUMMARY,
  ENSURE_CHURCH_DONATION_ELIGIBLE,
} from '@/providers/donation'
import {
  DonationListQuery,
  DonationSubscriptionListQuery,
  DonationSummary,
  DonationInputSchema,
  assertNoRawCardData,
} from '@/models/donation'

/*
 * Donation controller (Tasks 29-30). Routes authenticate + resolve the primary
 * church scope; this controller owns the remaining check that the requested
 * church is inside the resolved grant (404 hides cross-church existence) and
 * delegates scoped reads to the provider. No donor PII ever passes through.
 */

const ensureChurchInScope = (churchId: string, churchIds: Set<string>) => {
  if (!churchIds.has(churchId)) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
}

export const listDonations = async ({
  churchId,
  churchIds,
  query,
}: {
  churchId: string
  churchIds: Set<string>
  query: DonationListQuery
}) => {
  ensureChurchInScope(churchId, churchIds)
  return GET_DONATIONS({ churchIds, query })
}

export const listDonationSubscriptions = async ({
  churchId,
  churchIds,
  query,
}: {
  churchId: string
  churchIds: Set<string>
  query: DonationSubscriptionListQuery
}) => {
  ensureChurchInScope(churchId, churchIds)
  return GET_DONATION_SUBSCRIPTIONS({ churchIds, query })
}

export const getDonationSummary = async ({
  churchId,
  churchIds,
  month,
}: {
  churchId: string
  churchIds: Set<string>
  month: string
}): Promise<DonationSummary> => {
  ensureChurchInScope(churchId, churchIds)
  return GET_DONATION_SUMMARY({ churchIds, month })
}

export const initiateDonation = async ({
  churchId,
  userId,
  input,
  idempotencyKey,
}: {
  churchId: string
  userId?: string
  input: unknown
  idempotencyKey?: string
}) => {
  assertNoRawCardData(input)
  const validated = validate(DonationInputSchema, input)
  await ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId })

  const createSession = async () => {
    return STRIPE.createCheckoutSession({
      churchId,
      amountMinor: validated.amountMinor,
      currency: validated.currency,
      frequency: validated.frequency,
      successUrl:
        validated.successUrl ?? `https://app.prayer.com/churches/${churchId}/donations/success`,
      cancelUrl:
        validated.cancelUrl ?? `https://app.prayer.com/churches/${churchId}/donations/cancel`,
    })
  }

  let session: { sessionId: string; url: string }
  if (idempotencyKey && userId) {
    const idem = await withExternalIdempotency({
      actorKey: userId,
      key: idempotencyKey,
      operation: 'initiate_donation',
      requestBody: input,
      run: async () => {
        const res = await createSession()
        return JSON.stringify(res)
      },
    })
    const raw = idem.resource_id
    if (!raw) {
      throw new GeneralError({
        code: 500,
        error: 'INTERNAL_ERROR',
        error_code: 'IDEMPOTENCY_REPLAY_FAILED',
        details: 'Idempotency record has no session data.',
      })
    }
    try {
      const parsed = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.sessionId === 'string' &&
        typeof parsed.url === 'string'
      ) {
        session = parsed
      } else {
        throw new Error('Invalid session format')
      }
    } catch {
      throw new GeneralError({
        code: 500,
        error: 'INTERNAL_ERROR',
        error_code: 'IDEMPOTENCY_REPLAY_FAILED',
        details: 'Stored idempotency session payload is corrupt.',
      })
    }
  } else {
    session = await createSession()
  }
  return {
    sessionId: session.sessionId,
    url: session.url,
    churchId,
    amountMinor: validated.amountMinor,
    currency: validated.currency,
    frequency: validated.frequency,
  }
}
