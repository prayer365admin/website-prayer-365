'use client'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import {
  MobileChurchSummary,
  MobilePublicAnnouncement,
  MobilePublicChurch,
  MobilePublicEvent,
  MobilePublishedPrayer,
} from '@/models/mobile'

export const useSiteChurches = ({
  search,
  radius_km,
  latitude,
  longitude,
  denomination,
  language,
  sunday_live_stream,
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
    loading: query.isLoading || query.isFetching,
    isFetching: query.isFetching,
    error: query.error,
    retry: query.refetch,
  }
}

export const useSiteChurchProfile = (slug: string) => {
  const { data: session } = useSession()
  const userId = session?.user?.user_id

  const query = useQuery({
    queryKey: ['site', 'church', userId, slug],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/site/churches/${slug}`)
      return res.data.result as MobilePublicChurch
    },
    enabled: !!userId && !!slug,
  })

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
  }
}

export const useSiteChurchEvents = (slug: string) => {
  const { data: session } = useSession()
  const userId = session?.user?.user_id

  const query = useQuery({
    queryKey: ['site', 'churches', slug, 'events', userId],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/site/churches/${slug}/events`)
      return {
        events: (res.data.result ?? []) as MobilePublicEvent[],
        total: (res.data.total ?? 0) as number,
      }
    },
    enabled: !!userId && !!slug,
  })

  return {
    data: query.data?.events ?? [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
  }
}

export const useSiteChurchAnnouncements = (slug: string) => {
  const { data: session } = useSession()
  const userId = session?.user?.user_id

  const query = useQuery({
    queryKey: ['site', 'churches', slug, 'announcements', userId],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/site/churches/${slug}/announcements`)
      return {
        announcements: (res.data.result ?? []) as MobilePublicAnnouncement[],
        total: (res.data.total ?? 0) as number,
      }
    },
    enabled: !!userId && !!slug,
  })

  return {
    data: query.data?.announcements ?? [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
  }
}

export const useSiteChurchPrayers = (slug: string) => {
  const { data: session } = useSession()
  const userId = session?.user?.user_id

  const query = useQuery({
    queryKey: ['site', 'churches', slug, 'prayers', userId],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/site/churches/${slug}/prayers?page=1&limit=10`)
      const raw = res.data?.result
      const prayers = Array.isArray(raw) ? (raw as MobilePublishedPrayer[]) : []
      return {
        prayers,
        total: (res.data?.total ?? prayers.length) as number,
      }
    },
    enabled: !!userId && !!slug,
  })

  return {
    data: query.data?.prayers ?? [],
    total: query.data?.total ?? 0,
    loading: query.isLoading,
    error: query.error,
    retry: query.refetch,
  }
}
