import { ChurchOption } from '@/models/church-option'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useState } from 'react'

// Public church picker (WB1 sign-up step 2). No session needed.
const baseUrl = '/api/v1/public/churches'
const queryKey = ['site', 'church-options']

const SEARCH_DEBOUNCE_MS = 300

export const useChurchOptions = (search: string) => {
  const [debounced, setDebounced] = useState(search.trim())

  // One request per pause in typing, not per key stroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])
  const isDebouncing = search.trim() !== debounced

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...queryKey, debounced],
    queryFn: async () => {
      const result = await axios.get(baseUrl, { params: debounced ? { search: debounced } : {} })
      return result.data.result as ChurchOption[]
    },
    placeholderData: keepPreviousData,
  })

  return { data: data ?? [], loading: isLoading || isFetching || isDebouncing }
}

export const useFrequentChurches = () => {
  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, 'frequent'],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}/frequent`)
      return result.data.result as ChurchOption[]
    },
    // Server answer is CDN-cached for an hour; no need to refetch sooner.
    staleTime: 60 * 60 * 1000,
  })

  return { data: data ?? [], loading: isLoading }
}
