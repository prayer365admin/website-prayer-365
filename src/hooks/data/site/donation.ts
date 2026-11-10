import { DonationInitiateResult, DonationInput, DonationStatusView } from '@/models/donation'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useRef } from 'react'

/**
 * Website donations (WB-43). One Idempotency-Key per checkout attempt, so a
 * retried POST can never create a second Stripe session. The church travels in
 * the body and the giver comes from the session — the client sends neither as
 * part of the URL, and only ever calls this one literal endpoint.
 */
export const useInitiateDonation = () => {
  const { mutateAsync: onInitiate, isPending: initiating } = useMutation({
    mutationFn: async ({ churchId, input }: { churchId: string; input: DonationInput }) =>
      (
        await axios.post(
          '/api/v1/site/donations',
          { churchId, ...input },
          { headers: { 'Idempotency-Key': crypto.randomUUID() } },
        )
      ).data.result as DonationInitiateResult,
  })
  return { onInitiate, initiating }
}

/**
 * W11 "Pause or Modify Monthly Pledge": mints a Stripe billing-portal session
 * for the giver's own active pledge. The server resolves the subscription — the
 * client only says where to come back to.
 */
export const useOpenBillingPortal = () => {
  const { mutateAsync: onOpenPortal, isPending: opening } = useMutation({
    mutationFn: async ({ returnPath }: { returnPath: string }) =>
      (
        await axios.post(
          '/api/v1/site/donations/portal',
          { returnPath },
          { headers: { 'Idempotency-Key': crypto.randomUUID() } },
        )
      ).data.result as { url: string },
  })
  return { onOpenPortal, opening }
}

/**
 * W12 attempt outcome. Polls until the ledger confirms: our own records are the
 * source of truth, and a `failed` row is not final — Stripe can still settle the
 * same payment intent (payer retry, late 3-D Secure), which flips that row to
 * PAID a minute later. So the page keeps asking through `pending` AND for a short
 * grace after `failed`; an abandoned checkout stops on its own.
 */
const FAILED_GRACE_MS = 60 * 1000

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
  const failedSince = useRef<number | null>(null)
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
    refetchInterval: (current) => {
      const state = current.state.data?.state
      if (state === 'confirmed') return false
      if (state !== 'failed') {
        failedSince.current = null
        return 3000
      }
      // `failed` is provisional for one minute: the same attempt can still settle.
      const since = failedSince.current ?? Date.now()
      failedSince.current = since
      return Date.now() - since < FAILED_GRACE_MS ? 3000 : false
    },
    // A transient network blip must not end the watch on a real payment.
    retry: 5,
    retryDelay: 3000,
  })
  return { status: query.data ?? null, checking: query.isFetching }
}
