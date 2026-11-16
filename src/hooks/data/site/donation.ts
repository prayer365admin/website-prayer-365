import {
  DonationInitiateResult,
  DonationInput,
  DonationStatusView,
  PublicDonationStatusClientView,
} from '@/models/donation'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useRef } from 'react'

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
 * Public giving (`/give`, PD-UI-02). A guest has no actor to key an idempotent
 * request on (D-13), so no `Idempotency-Key` is sent; a duplicate Checkout
 * session simply expires unpaid and writes no ledger row.
 */
export const useInitiatePublicDonation = () => {
  const { mutateAsync: onInitiate, isPending: initiating } = useMutation({
    mutationFn: async ({
      input,
    }: {
      input: { amountMinor: number; currency: string; frequency: 'one_time' }
    }) =>
      (await axios.post('/api/v1/site/donations/public', input)).data
        .result as DonationInitiateResult,
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
/** Adaptive backoff: a fresh redirect is checked fast, an old one rarely. */
const POLL_FAST_MS = 3_000
const POLL_SLOW_MS = 10_000
const POLL_IDLE_MS = 30_000
const POLL_FAST_WINDOW_MS = 60 * 1000
const POLL_SLOW_WINDOW_MS = 5 * 60 * 1000
/** Hard stop at the checkout session TTL (31 min): past it nobody can pay. */
export const POLL_TOTAL_MS = 31 * 60 * 1000

/**
 * Next refetch delay for the result page, or `false` to stop. Pure on purpose: the
 * backoff ladder and the hard stop are the whole behaviour, so they are unit-tested
 * directly instead of through fake timers.
 */
export const nextDonationPollInterval = ({
  state,
  elapsedMs,
  failedSinceMs,
  nowMs,
}: {
  state?: string
  elapsedMs: number
  failedSinceMs: number | null
  nowMs: number
}): number | false => {
  // Both are settled ledger outcomes: nothing in the checkout can change them.
  if (state === 'confirmed' || state === 'refunded') return false
  if (elapsedMs >= POLL_TOTAL_MS) return false
  // `failed` is provisional for one minute: the same attempt can still settle.
  if (state === 'failed') {
    const since = failedSinceMs ?? nowMs
    return nowMs - since < FAILED_GRACE_MS ? POLL_FAST_MS : false
  }
  if (elapsedMs < POLL_FAST_WINDOW_MS) return POLL_FAST_MS
  return elapsedMs < POLL_SLOW_WINDOW_MS ? POLL_SLOW_MS : POLL_IDLE_MS
}

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
  const startedAt = useRef<number | null>(null)
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
      const now = Date.now()
      const sinceStart = (startedAt.current ??= now)
      const interval = nextDonationPollInterval({
        state: current.state.data?.state,
        elapsedMs: now - sinceStart,
        failedSinceMs: failedSince.current,
        nowMs: now,
      })
      // Remember when the provisional `failed` state first appeared.
      failedSince.current =
        current.state.data?.state === 'failed' ? (failedSince.current ?? now) : null
      return interval
    },
    // A transient network blip must not end the watch on a real payment.
    retry: 5,
    retryDelay: 3000,
  })
  // Returning to the tab re-checks once: the interval ladder stops on a
  // provisional `failed`, and a giver should not have to reload the page.
  useEffect(() => {
    const wake = () => void query.refetch()
    window.addEventListener('focus', wake)
    return () => window.removeEventListener('focus', wake)
  }, [query])
  return { status: query.data ?? null, checking: query.isFetching }
}

/**
 * The public thank-you page's own watch (PD-UI-03). Same rules, same backoff and
 * same hard stop as `useDonationStatus` — the shared `nextDonationPollInterval`
 * is reused verbatim rather than forked, because two ladders would drift and a
 * paid guest would be parked on the wrong screen. The server scopes the answer to
 * the platform's own sessions (D-14); the client only names the session.
 */
export const usePublicDonationStatus = ({
  sessionId,
  enabled,
}: {
  sessionId: string | null
  enabled: boolean
}) => {
  const failedSince = useRef<number | null>(null)
  const startedAt = useRef<number | null>(null)
  const query = useQuery({
    queryKey: ['site', 'donations', 'public', 'status', sessionId],
    queryFn: async () =>
      (
        await axios.get('/api/v1/site/donations/public/status', {
          params: { sessionId },
        })
      ).data.result as PublicDonationStatusClientView,
    enabled: enabled && Boolean(sessionId),
    refetchInterval: (current) => {
      const now = Date.now()
      const sinceStart = (startedAt.current ??= now)
      const interval = nextDonationPollInterval({
        state: current.state.data?.state,
        elapsedMs: now - sinceStart,
        failedSinceMs: failedSince.current,
        nowMs: now,
      })
      failedSince.current =
        current.state.data?.state === 'failed' ? (failedSince.current ?? now) : null
      return interval
    },
    retry: 5,
    retryDelay: 3000,
  })
  // Same one-shot wake as the signed-in watch: a tab return re-checks once.
  useEffect(() => {
    const wake = () => void query.refetch()
    window.addEventListener('focus', wake)
    return () => window.removeEventListener('focus', wake)
  }, [query])
  return { status: query.data ?? null, checking: query.isFetching }
}
