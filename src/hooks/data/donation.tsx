import { DonationRow, DonationSubscriptionRow, DonationSummary } from '@/models/donation'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

export interface DonationListOptions {
  churchId?: string
  /**
   * Central report instead of a parish one: guest gifts attributed to the hidden
   * platform church. `churchId` is ignored when set.
   */
  platform?: boolean
  page?: number
  limit?: number
  orderBy?: 'paid_at' | 'created_at' | 'amount'
  orderDirection?: 'asc' | 'desc'
  from?: string | Date
  to?: string | Date
  currency?: string
  enableFetch?: boolean
}

export type DonationListFilters = Omit<DonationListOptions, 'churchId' | 'platform' | 'enableFetch'>

export interface DonationSubscriptionListOptions {
  churchId: string
  page?: number
  limit?: number
  orderBy?: 'created_at' | 'amount' | 'provider_status'
  orderDirection?: 'asc' | 'desc'
  currency?: string
  enableFetch?: boolean
}

export type DonationSubscriptionListFilters = Omit<
  DonationSubscriptionListOptions,
  'churchId' | 'enableFetch'
>

export interface DonationSummaryOptions {
  churchId?: string
  /** Guest gifts (platform beneficiary) instead of a parish summary. */
  platform?: boolean
  month: string
  enableFetch?: boolean
}

export const donationKeys = {
  all: ['donations'] as const,
  transactionsRoot: (userId: string | undefined, churchId: string) =>
    ['donations', 'transactions', userId, churchId] as const,
  transactions: (userId: string | undefined, churchId: string, filters: DonationListFilters) =>
    [...donationKeys.transactionsRoot(userId, churchId), filters] as const,
  recurringRoot: (userId: string | undefined, churchId: string) =>
    ['donations', 'recurring', userId, churchId] as const,
  recurring: (
    userId: string | undefined,
    churchId: string,
    filters: DonationSubscriptionListFilters,
  ) => [...donationKeys.recurringRoot(userId, churchId), filters] as const,
  summaryRoot: (userId: string | undefined, churchId: string) =>
    ['donations', 'summary', userId, churchId] as const,
  summary: (userId: string | undefined, churchId: string, month: string) =>
    [...donationKeys.summaryRoot(userId, churchId), month] as const,
}

export const useDonations = (options: DonationListOptions) => {
  const {
    churchId,
    platform = false,
    page = 1,
    limit = 25,
    orderBy = 'paid_at',
    orderDirection = 'desc',
    from,
    to,
    currency,
    enableFetch = true,
  } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const queryParams = new URLSearchParams()
  queryParams.set('page', page.toString())
  queryParams.set('limit', limit.toString())
  queryParams.set('order_by', orderBy)
  queryParams.set('order_direction', orderDirection)

  if (from) {
    queryParams.set('from', typeof from === 'string' ? from : from.toISOString())
  }
  if (to) {
    queryParams.set('to', typeof to === 'string' ? to : to.toISOString())
  }
  if (currency) {
    queryParams.set('currency', currency)
  }

  // `platform` reads the guest-giving ledger at central scope; the scope string
  // keeps the two reports in separate cache buckets.
  const scopeId = platform ? 'platform' : (churchId ?? '')
  const listUrl = platform
    ? '/api/v1/admin/central/donations'
    : `/api/v1/admin/churches/${encodeURIComponent(churchId ?? '')}/donations`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: donationKeys.transactions(userId, scopeId, {
      page,
      limit,
      orderBy,
      orderDirection,
      from: from instanceof Date ? from.toISOString() : from,
      to: to instanceof Date ? to.toISOString() : to,
      currency,
    }),
    queryFn: async () => {
      const response = await axios.get(`${listUrl}?${queryParams.toString()}`)
      return {
        result: response.data.result as DonationRow[],
        total: response.data.total as number,
      }
    },
    enabled: Boolean(enableFetch && scopeId),
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading, error, refetch }
}

export const useDonationSubscriptions = (options: DonationSubscriptionListOptions) => {
  const {
    churchId,
    page = 1,
    limit = 25,
    orderBy = 'created_at',
    orderDirection = 'desc',
    currency,
    enableFetch = true,
  } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const queryParams = new URLSearchParams()
  queryParams.set('page', page.toString())
  queryParams.set('limit', limit.toString())
  queryParams.set('order_by', orderBy)
  queryParams.set('order_direction', orderDirection)
  if (currency) {
    queryParams.set('currency', currency)
  }

  const listUrl = `/api/v1/admin/churches/${encodeURIComponent(churchId)}/donation-subscriptions`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: donationKeys.recurring(userId, churchId, {
      page,
      limit,
      orderBy,
      orderDirection,
      currency,
    }),
    queryFn: async () => {
      const response = await axios.get(`${listUrl}?${queryParams.toString()}`)
      return {
        result: response.data.result as DonationSubscriptionRow[],
        total: response.data.total as number,
      }
    },
    enabled: Boolean(enableFetch && churchId),
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading, error, refetch }
}

export const useDonationSummary = (options: DonationSummaryOptions) => {
  const { churchId, platform = false, month, enableFetch = true } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const scopeId = platform ? 'platform' : (churchId ?? '')
  const summaryUrl = platform
    ? `/api/v1/admin/central/donation-summary?month=${encodeURIComponent(month)}`
    : `/api/v1/admin/churches/${encodeURIComponent(churchId ?? '')}/donation-summary?month=${encodeURIComponent(month)}`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: donationKeys.summary(userId, scopeId, month),
    queryFn: async () => {
      const response = await axios.get(summaryUrl)
      return response.data.result as DonationSummary
    },
    enabled: Boolean(enableFetch && scopeId && month),
  })

  return { data, loading: isLoading, error, refetch }
}
