import { DonationRow, DonationSubscriptionRow, DonationSummary } from '@/models/donation'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

export interface DonationListOptions {
  churchId: string
  page?: number
  limit?: number
  orderBy?: 'paid_at' | 'created_at' | 'amount'
  orderDirection?: 'asc' | 'desc'
  from?: string | Date
  to?: string | Date
  enableFetch?: boolean
}

export type DonationListFilters = Omit<DonationListOptions, 'churchId' | 'enableFetch'>

export interface DonationSubscriptionListOptions {
  churchId: string
  page?: number
  limit?: number
  orderBy?: 'created_at' | 'amount' | 'provider_status'
  orderDirection?: 'asc' | 'desc'
  enableFetch?: boolean
}

export type DonationSubscriptionListFilters = Omit<
  DonationSubscriptionListOptions,
  'churchId' | 'enableFetch'
>

export interface DonationSummaryOptions {
  churchId: string
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
    page = 1,
    limit = 25,
    orderBy = 'paid_at',
    orderDirection = 'desc',
    from,
    to,
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

  const listUrl = `/api/v1/admin/churches/${encodeURIComponent(churchId)}/donations`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: donationKeys.transactions(userId, churchId, {
      page,
      limit,
      orderBy,
      orderDirection,
      from: from instanceof Date ? from.toISOString() : from,
      to: to instanceof Date ? to.toISOString() : to,
    }),
    queryFn: async () => {
      const response = await axios.get(`${listUrl}?${queryParams.toString()}`)
      return {
        result: response.data.result as DonationRow[],
        total: response.data.total as number,
      }
    },
    enabled: Boolean(enableFetch && churchId),
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
    enableFetch = true,
  } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const queryParams = new URLSearchParams()
  queryParams.set('page', page.toString())
  queryParams.set('limit', limit.toString())
  queryParams.set('order_by', orderBy)
  queryParams.set('order_direction', orderDirection)

  const listUrl = `/api/v1/admin/churches/${encodeURIComponent(churchId)}/donation-subscriptions`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: donationKeys.recurring(userId, churchId, { page, limit, orderBy, orderDirection }),
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
  const { churchId, month, enableFetch = true } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const summaryUrl = `/api/v1/admin/churches/${encodeURIComponent(churchId)}/donation-summary?month=${encodeURIComponent(month)}`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: donationKeys.summary(userId, churchId, month),
    queryFn: async () => {
      const response = await axios.get(summaryUrl)
      return response.data.result as DonationSummary
    },
    enabled: Boolean(enableFetch && churchId && month),
  })

  return { data, loading: isLoading, error, refetch }
}
