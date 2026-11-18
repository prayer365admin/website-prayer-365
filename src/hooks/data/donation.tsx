import {
  type AdminDonationRow,
  type AdminDonationSummary,
  DonationSubscriptionRow,
  DonationSummary,
  type MonthlySummaryRow,
} from '@/models/donation'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

export interface DonationListOptions {
  churchId?: string
  page?: number
  limit?: number
  orderBy?: 'paid_at' | 'created_at' | 'amount'
  orderDirection?: 'asc' | 'desc'
  from?: string | Date
  to?: string | Date
  currency?: string
  /** Ledger state filter; the money summary stays PAID-based (T-05). */
  status?: 'PAID' | 'FAILED' | 'REFUNDED'
  enableFetch?: boolean
}

export type DonationListFilters = Omit<DonationListOptions, 'churchId' | 'enableFetch'>

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
    currency,
    status,
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
  if (status) {
    queryParams.set('status', status)
  }

  const listUrl = `/api/v1/admin/churches/${encodeURIComponent(churchId ?? '')}/donations`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: donationKeys.transactions(userId, churchId ?? '', {
      page,
      limit,
      orderBy,
      orderDirection,
      from: from instanceof Date ? from.toISOString() : from,
      to: to instanceof Date ? to.toISOString() : to,
      currency,
      status,
    }),
    queryFn: async () => {
      const response = await axios.get(`${listUrl}?${queryParams.toString()}`)
      return {
        result: response.data.result as AdminDonationRow[],
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
  const { churchId, month, enableFetch = true } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const summaryUrl = `/api/v1/admin/churches/${encodeURIComponent(churchId ?? '')}/donation-summary?month=${encodeURIComponent(month)}`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: donationKeys.summary(userId, churchId ?? '', month),
    queryFn: async () => {
      const response = await axios.get(summaryUrl)
      return response.data.result as DonationSummary
    },
    enabled: Boolean(enableFetch && churchId && month),
  })

  return { data, loading: isLoading, error, refetch }
}

/*
 * All-church report (`/dashboard/donations`). No church path segment: the
 * central guard already resolved every church in scope on the server, so the
 * browser never composes a church id into the URL.
 */

export interface AdminDonationListOptions {
  page?: number
  limit?: number
  orderBy?: 'paid_at' | 'created_at' | 'amount'
  orderDirection?: 'asc' | 'desc'
  from?: string | Date
  to?: string | Date
  status?: 'PAID' | 'FAILED' | 'REFUNDED'
  churchId?: string
  currency?: string
  enableFetch?: boolean
}

export type AdminDonationListFilters = Omit<AdminDonationListOptions, 'enableFetch'>

/** A 403 is an authorization answer, not a transient fault: retrying it only adds requests. */
const retryUnlessForbidden = (failureCount: number, error: Error) =>
  !(axios.isAxiosError(error) && error.response?.status === 403) && failureCount < 3

export interface AdminDonationSummaryOptions {
  from?: string | Date
  to?: string | Date
  churchId?: string
  enableFetch?: boolean
}

/** Central recurring tab: every church's plans, optionally narrowed. */
export interface AdminDonationSubscriptionListOptions {
  page?: number
  limit?: number
  orderBy?: 'created_at' | 'amount'
  orderDirection?: 'asc' | 'desc'
  currency?: string
  churchId?: string
  enableFetch?: boolean
}

/** Central monthly summary tab: one row per month + currency. */
export interface AdminMonthlySummaryOptions {
  from?: string | Date
  to?: string | Date
  churchId?: string
  enableFetch?: boolean
}

export const useAdminDonations = (options: AdminDonationListOptions) => {
  const {
    page = 1,
    limit = 25,
    orderBy = 'paid_at',
    orderDirection = 'desc',
    from,
    to,
    status,
    churchId,
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
  if (status) {
    queryParams.set('status', status)
  }
  if (churchId) {
    queryParams.set('churchId', churchId)
  }
  if (currency) {
    queryParams.set('currency', currency)
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      ...donationKeys.all,
      'admin',
      userId,
      {
        page,
        limit,
        orderBy,
        orderDirection,
        from: from instanceof Date ? from.toISOString() : from,
        to: to instanceof Date ? to.toISOString() : to,
        status,
        churchId,
        currency,
      },
    ] as const,
    queryFn: async () => {
      const response = await axios.get(`/api/v1/admin/donations?${queryParams.toString()}`)
      return {
        result: response.data.result as AdminDonationRow[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch,
    retry: retryUnlessForbidden,
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading, error, refetch }
}

export const useAdminDonationSummary = (options: AdminDonationSummaryOptions) => {
  const { from, to, churchId, enableFetch = true } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const queryParams = new URLSearchParams()
  if (from) {
    queryParams.set('from', typeof from === 'string' ? from : from.toISOString())
  }
  if (to) {
    queryParams.set('to', typeof to === 'string' ? to : to.toISOString())
  }
  if (churchId) {
    queryParams.set('churchId', churchId)
  }
  const qs = queryParams.toString()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      ...donationKeys.all,
      'admin-summary',
      userId,
      {
        from: from instanceof Date ? from.toISOString() : from,
        to: to instanceof Date ? to.toISOString() : to,
        churchId,
      },
    ] as const,
    queryFn: async () => {
      const response = await axios.get(`/api/v1/admin/donations/summary${qs ? `?${qs}` : ''}`)
      return response.data.result as AdminDonationSummary
    },
    enabled: enableFetch,
    retry: retryUnlessForbidden,
  })

  return { data, loading: isLoading, error, refetch }
}

export const useAdminDonationSubscriptions = (options: AdminDonationSubscriptionListOptions) => {
  const {
    page = 1,
    limit = 25,
    orderBy = 'created_at',
    orderDirection = 'desc',
    currency,
    churchId,
    enableFetch = true,
  } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const queryParams = new URLSearchParams()
  queryParams.set('page', page.toString())
  queryParams.set('limit', limit.toString())
  queryParams.set('order_by', orderBy)
  queryParams.set('order_direction', orderDirection)
  if (currency) queryParams.set('currency', currency)
  if (churchId) queryParams.set('churchId', churchId)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      ...donationKeys.all,
      'admin-recurring',
      userId,
      { page, limit, orderBy, orderDirection, currency, churchId },
    ] as const,
    queryFn: async () => {
      const response = await axios.get(
        `/api/v1/admin/donations/recurring?${queryParams.toString()}`,
      )
      return {
        result: response.data.result as DonationSubscriptionRow[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch,
    retry: retryUnlessForbidden,
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading, error, refetch }
}

export const useAdminDonationSummaryMonthly = (options: AdminMonthlySummaryOptions) => {
  const { from, to, churchId, enableFetch = true } = options
  const { data: session } = useSession()
  const userId = session?.user?.user_id ?? undefined

  const queryParams = new URLSearchParams()
  if (from) {
    queryParams.set('from', typeof from === 'string' ? from : from.toISOString())
  }
  if (to) {
    queryParams.set('to', typeof to === 'string' ? to : to.toISOString())
  }
  if (churchId) queryParams.set('churchId', churchId)
  const qs = queryParams.toString()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      ...donationKeys.all,
      'admin-monthly-summary',
      userId,
      {
        from: from instanceof Date ? from.toISOString() : from,
        to: to instanceof Date ? to.toISOString() : to,
        churchId,
      },
    ] as const,
    queryFn: async () => {
      const response = await axios.get(
        `/api/v1/admin/donations/summary/monthly${qs ? `?${qs}` : ''}`,
      )
      return response.data.result as MonthlySummaryRow[]
    },
    enabled: enableFetch,
    retry: retryUnlessForbidden,
  })

  return { data: data ?? [], loading: isLoading, error, refetch }
}
