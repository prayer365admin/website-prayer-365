import { GeneralError } from '@/utils/general-error'

/*
 * Scoped list query parsing (SPEC §6.1): clamped page/limit defaults
 * (1/25, max 100), endpoint-specific `order_by` allowlist, and the provider
 * must add `id` as a stable tie-breaker. Rejects arbitrary order_by columns.
 */

export interface ParsedListQuery {
  page: number
  limit: number
  order_by: string
  order_direction: 'asc' | 'desc'
  search?: string
}

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 25
export const MAX_LIMIT = 100

export const parseListQuery = (
  searchParams: URLSearchParams,
  { allowOrderBy, defaults = ['created_at'] }: { allowOrderBy: string[]; defaults?: string[] },
): ParsedListQuery => {
  const search = searchParams.get('search') || undefined

  const order_by = searchParams.get('order_by') || defaults[0]
  if (!allowOrderBy.includes(order_by)) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_ORDER_BY',
      details: `'order_by' must be one of: ${allowOrderBy.join(', ')}.`,
    })
  }

  const order_direction: 'asc' | 'desc' =
    (searchParams.get('order_direction') as 'asc' | 'desc') || 'desc'
  if (order_direction !== 'asc' && order_direction !== 'desc') {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_ORDER_DIRECTION',
      details: "'order_direction' must be 'asc' or 'desc'.",
    })
  }

  const rawPage = searchParams.get('page')
  const rawLimit = searchParams.get('limit')
  let page = DEFAULT_PAGE
  let limit = DEFAULT_LIMIT

  if (rawPage !== null && rawPage !== '' && Number.isFinite(+rawPage)) {
    const normalizedPage = Math.max(1, Math.floor(+rawPage))
    if (Number.isSafeInteger(normalizedPage)) page = normalizedPage
  }
  if (rawLimit !== null && rawLimit !== '' && Number.isFinite(+rawLimit)) {
    limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(+rawLimit)))
  }

  return { page, limit, order_by, order_direction, search }
}
