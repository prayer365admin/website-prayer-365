'use client'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { MobileChurchSummary, MobilePublicChurch } from '@/models/mobile'

export const useSiteChurches = ({
  search,
  radius_km,
  latitude,
  longitude,
  denomination,
  language,
  sunday_live_stream,
  open_now,
  taize_chants,
  youth_ministry,
  page,
  limit = 24,
}: {
  search?: string
  radius_km?: number
  latitude?: number
  longitude?: number
  denomination?: string
  language?: string
  sunday_live_stream?: boolean
  open_now?: boolean
  taize_chants?: boolean
  youth_ministry?: boolean
  page: number
  limit?: number
}) => {
  const { data: session } = useSession()
  const userId = session?.user?.user_id

  const query = useQuery({
    queryKey: [
      'site',
      'churches',
      userId,
      search ?? '',
      radius_km ?? '',
      latitude ?? '',
      longitude ?? '',
      denomination ?? '',
      language ?? '',
      sunday_live_stream ?? '',
      open_now ?? '',
      taize_chants ?? '',
      youth_ministry ?? '',
      page,
      limit,
    ],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.search = search
      if (radius_km !== undefined) params.radius_km = radius_km
      if (latitude !== undefined) params.latitude = latitude
      if (longitude !== undefined) params.longitude = longitude
      if (denomination) params.denomination = denomination
      if (language) params.language = language
      if (sunday_live_stream !== undefined) params.sunday_live_stream = sunday_live_stream
      if (open_now !== undefined) params.open_now = open_now
      if (taize_chants !== undefined) params.taize_chants = taize_chants
      if (youth_ministry !== undefined) params.youth_ministry = youth_ministry
      const res = await axios.get('/api/v1/site/churches', { params })
      return { result: res.data.result as MobileChurchSummary[], total: res.data.total as number }
    },
    enabled: !!userId,
    placeholderData: keepPreviousData,
  })

  return {
    data: query.data?.result,
    total: query.data?.total,
    loading: query.isLoading,
    isFetching: query.isFetching,
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
