import { GeneralQueryParams } from '@/models/general-query-params'
import { GeneralError } from './general-error'
import { MAX_LIMIT } from './pagination'

export function parseSearchParams<T extends Record<string, unknown>>(
  searchParams: URLSearchParams,
  schema?: T,
): Partial<T> & GeneralQueryParams {
  const parsed: Partial<T> & GeneralQueryParams = {}

  const search = searchParams.get('search') || undefined
  const order_by = searchParams.get('order_by') || 'created_at'
  const order_direction = searchParams.get('order_direction') || 'desc'
  const page = searchParams.get('page') || undefined
  const limit = searchParams.get('limit') || undefined

  if (order_direction !== 'asc' && order_direction !== 'desc') {
    throw new GeneralError({
      code: 400,
      details: 'Search params is invalid!',
      error: 'BAD_REQUEST',
      error_code: 'SEARCH_PARAMS_INVALID',
    })
  }

  parsed.search = search
  parsed.order_by = order_by
  parsed.order_direction = order_direction
  const normalizedPage = page && Number.isFinite(+page) ? Math.max(1, Math.floor(+page)) : undefined
  parsed.page = Number.isSafeInteger(normalizedPage) ? normalizedPage : undefined
  parsed.limit =
    limit && Number.isFinite(+limit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(+limit)))
      : undefined

  for (const key in schema) {
    const rawValue = searchParams.get(key)

    if (rawValue !== null) {
      const expectedType = schema[key]

      if (expectedType === Number) {
        const num = parseInt(rawValue, 10)
        if (!isNaN(num)) parsed[key] = num as T[typeof key]
      } else if (expectedType === Boolean) {
        parsed[key] = (rawValue === 'true') as T[typeof key]
      } else {
        parsed[key] = rawValue as T[typeof key]
      }
    }
  }

  return parsed
}
