'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'

/*
 * URL-backed filter state for the donation reports (plan 043, T6).
 *
 * The console shares and refreshes links, so a filter is only real when it is in the query
 * string. The hook keeps a local copy (so a click re-renders immediately) and mirrors every
 * change into the URL, removing `page` so a narrowed list never lands on an empty page 4.
 */

export type DonationFilterKey =
  'tab' | 'churchId' | 'type' | 'currency' | 'status' | 'month' | 'from' | 'to'

/** Filter key -> query-string parameter. `churchId` is shortened for readability. */
const PARAM: Record<DonationFilterKey, string> = {
  tab: 'tab',
  churchId: 'church',
  type: 'type',
  currency: 'currency',
  status: 'status',
  month: 'month',
  from: 'from',
  to: 'to',
}

const KEYS = Object.keys(PARAM) as DonationFilterKey[]

export type DonationFilters = Partial<Record<DonationFilterKey, string>>

export const useDonationFilters = <T extends DonationFilters>(defaults: T) => {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [state, setState] = useState<DonationFilters>(() => {
    const initial: DonationFilters = {}
    for (const key of KEYS) {
      const raw = params.get(PARAM[key])
      if (raw) initial[key] = raw
    }
    return initial
  })

  const set = useCallback(
    (patch: DonationFilters) => {
      setState((previous) => {
        const nextState: DonationFilters = { ...previous }
        for (const [key, value] of Object.entries(patch)) {
          const filterKey = key as DonationFilterKey
          if (value === undefined || value === '') delete nextState[filterKey]
          else nextState[filterKey] = value
        }

        const next = new URLSearchParams(params.toString())
        for (const key of KEYS) {
          const value = nextState[key]
          if (value === undefined) next.delete(PARAM[key])
          else next.set(PARAM[key], value)
        }
        next.delete('page')
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
        return nextState
      })
    },
    [params, pathname, router],
  )

  const filters = {} as Record<DonationFilterKey, string | undefined>
  for (const key of KEYS) filters[key] = state[key] ?? defaults[key] ?? undefined

  return { filters, setFilters: set }
}
