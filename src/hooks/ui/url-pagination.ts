'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Dispatch, SetStateAction, useCallback } from 'react'
import { MAX_LIMIT } from '@/utils/pagination'

const positiveInteger = (value: string | null, fallback: number, maximum?: number) => {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback
  return maximum ? Math.min(parsed, maximum) : parsed
}

type UrlPaginationOptions = {
  defaultPageSize?: number
  pageParam?: string
  pageSizeParam?: string
}

/** Keeps table pagination bookmarkable while preserving the route's other query parameters. */
export const useUrlPagination = ({
  defaultPageSize = 10,
  pageParam = 'page',
  pageSizeParam = 'limit',
}: UrlPaginationOptions = {}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const page = positiveInteger(searchParams.get(pageParam), 1)
  const pageSize = positiveInteger(searchParams.get(pageSizeParam), defaultPageSize, MAX_LIMIT)

  const replacePagination = useCallback(
    (nextPage: number, nextPageSize: number) => {
      const params = new URLSearchParams(searchParams.toString())
      const normalizedPage = Math.max(1, Math.floor(nextPage))
      params.set(pageParam, String(Number.isSafeInteger(normalizedPage) ? normalizedPage : 1))
      params.set(pageSizeParam, String(Math.min(MAX_LIMIT, Math.max(1, Math.floor(nextPageSize)))))
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pageParam, pageSizeParam, pathname, router, searchParams],
  )

  const setPage: Dispatch<SetStateAction<number>> = useCallback(
    (value) => {
      const nextPage = typeof value === 'function' ? value(page) : value
      if (nextPage !== page) replacePagination(nextPage, pageSize)
    },
    [page, pageSize, replacePagination],
  )

  const setPageSize: Dispatch<SetStateAction<number>> = useCallback(
    (value) => {
      const nextPageSize = typeof value === 'function' ? value(pageSize) : value
      if (nextPageSize !== pageSize) replacePagination(1, nextPageSize)
    },
    [pageSize, replacePagination],
  )

  return { page, pageSize, setPage, setPageSize, replacePagination }
}
