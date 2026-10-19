'use client'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { MobileHome } from '@/models/mobile'

export const useSiteHome = () => {
  const { data: session } = useSession()
  const userId = session?.user?.user_id

  const query = useQuery({
    queryKey: ['site', 'home', userId],
    queryFn: async () => {
      const res = await axios.get('/api/v1/site/home')
      return (res.data.result ?? null) as MobileHome | null
    },
    enabled: !!userId,
  })

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
  }
}
