import { GeneralError } from '@/utils/general-error'
import {
  GET_DONATIONS,
  GET_DONATION_SUBSCRIPTIONS,
  GET_DONATION_SUMMARY,
} from '@/providers/donation'
import {
  DonationListQuery,
  DonationSubscriptionListQuery,
  DonationSummary,
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
