'use client'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { MobileChurchSummary, MobilePublicChurch } from '@/models/mobile'

export const useSiteChurches = ({
  search,
  page,
  limit = 24,
}: {
  search?: string
  page: number
  limit?: number
}) => {
  const { data: session } = useSession()
  const userId = session?.user?.user_id

  const query = useQuery({
    queryKey: ['site', 'churches', userId, search ?? '', page, limit],
    queryFn: async () => {
      const res = await axios.get('/api/v1/site/churches', { params: { search, page, limit } })
      return { result: res.data.result as MobileChurchSummary[], total: res.data.total as number }
    },
    enabled: !!userId,
    placeholderData: keepPreviousData,
  })

  return {
    data: query.data?.result,
    total: query.data?.total,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
  }
}

export const useSiteChurchProfile = (churchId: string) => {
  const { data: session } = useSession()
  const userId = session?.user?.user_id

  const query = useQuery({
    queryKey: ['site', 'church', userId, churchId],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/site/churches/${churchId}`)
      return res.data.result as MobilePublicChurch
    },
    enabled: !!userId && !!churchId,
  })

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
  }
}
