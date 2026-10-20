import { DonationInitiateResult, DonationInput, DonationStatusView } from '@/models/donation'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'

/**
 * Website donations (WB-43). One Idempotency-Key per checkout attempt, so a
 * retried POST can never create a second Stripe session. The church comes from
 * the route and the giver from the session — the client sends neither.
 *
 * Only a uuid-shaped id may be placed in the URL path, so nothing can escape the
 * donations segment. The request is same-origin and relative: no host is built
 * from input.
 */
const donationPathFor = (churchId: string) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(churchId)) throw new Error('Invalid church id')
  return '/api/v1/site/churches/' + encodeURIComponent(churchId) + '/donations'
}

export const useInitiateDonation = () => {
  const { mutateAsync: onInitiate, isPending: initiating } = useMutation({
    mutationFn: async ({ churchId, input }: { churchId: string; input: DonationInput }) =>
      (
        await axios.post(donationPathFor(churchId), input, {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        })
      ).data.result as DonationInitiateResult,
  })
  return { onInitiate, initiating }
}

/**
 * W12 attempt outcome. Polls only while the recorded state is `pending`: our own
 * ledger is the source of truth, so the page keeps asking until a PAID row (or a
 * failure) exists, and never assumes success.
 */
export const useDonationStatus = ({
  attempt,
  enabled,
}: {
  attempt: {
    sessionId: string | null
    churchId: string
    amountMinor: number | null
    currency: string | null
    frequency: 'one_time' | 'monthly' | null
  }
  enabled: boolean
}) => {
  const { sessionId, churchId, amountMinor, currency, frequency } = attempt
  const query = useQuery({
    queryKey: [
      'site',
      'donations',
      'status',
      sessionId,
      churchId,
      amountMinor,
      currency,
      frequency,
    ],
    queryFn: async () =>
      (
        await axios.get('/api/v1/site/donations/status', {
          params: { sessionId, churchId, amountMinor, currency, frequency },
        })
      ).data.result as DonationStatusView,
    enabled: enabled && Boolean(sessionId && churchId && amountMinor && currency && frequency),
    refetchInterval: (current) => (current.state.data?.state === 'pending' ? 3000 : false),
    // A transient network blip must not end the watch on a real payment.
    retry: 5,
    retryDelay: 3000,
  })
  return { status: query.data ?? null, checking: query.isFetching }
}
