import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, Providers, resolveGet, sessionMock } from '@/test/frontend/render'
import { useSiteChurches, useSiteChurchPrayers, useSiteChurchProfile } from './churches'

const summary = {
  id: 'c1',
  name: 'Grace',
  denomination: 'Lutheran',
  city: 'Tallinn',
  coverAssetId: null,
  coverUrl: null,
  distanceKm: null,
}

describe('useSiteChurches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches churches when user session is present', async () => {
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'u1' } },
      status: 'authenticated',
    })
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([summary], 1) })

    const { result } = renderHook(() => useSiteChurches({ search: 'grace', page: 2, limit: 24 }), {
      wrapper: Providers,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual([summary])
    expect(result.current.total).toBe(1)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
      params: { search: 'grace', page: 2, limit: 24 },
    })
  })

  it('forwards directory filter parameters to the API request', async () => {
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'u1' } },
      status: 'authenticated',
    })
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([summary], 1) })

    const { result } = renderHook(
      () =>
        useSiteChurches({
          search: 'grace',
          radius_km: 10,
          latitude: 59.437,
          longitude: 24.754,
          denomination: 'Lutheran',
          language: 'et',
          sunday_live_stream: true,
          taize_chants: true,
          youth_ministry: true,
          page: 1,
          limit: 24,
        }),
      { wrapper: Providers },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
      params: {
        search: 'grace',
        radius_km: 10,
        latitude: 59.437,
        longitude: 24.754,
        denomination: 'Lutheran',
        language: 'et',
        sunday_live_stream: true,
        taize_chants: true,
        youth_ministry: true,
        page: 1,
        limit: 24,
      },
    })
  })

  it('does not fetch churches when user session is absent', async () => {
    sessionMock.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    const { result } = renderHook(() => useSiteChurches({ search: 'grace', page: 1 }), {
      wrapper: Providers,
    })

    expect(result.current.loading).toBe(false)
    expect(axiosMock.get).not.toHaveBeenCalled()
  })
})

describe('useSiteChurchProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const church = {
    id: 'c1',
    name: 'Grace',
    denomination: 'Lutheran',
    description: 'A historic parish.',
    timezone: 'Europe/Tallinn',
    address: {
      line1: 'Main St 1',
      line2: null,
      city: 'Tallinn',
      postalCode: '10111',
      countryCode: 'EE',
    },
    coordinates: null,
    contacts: {
      email: 'office@grace.ee',
      phone: '+372 123 4567',
    },
    socialLinks: [],
    coverAssetId: null,
    coverUrl: 'https://cdn.test/cover.jpg',
    languageCodes: ['et', 'en'],
    serviceTimes: [
      {
        weekday: 7,
        localTime: '10:00',
        label: 'Sunday Service',
        languageCode: 'et',
      },
    ],
    distanceKm: null,
  }

  it('fetches church profile when user session is present and churchId is provided', async () => {
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'u1' } },
      status: 'authenticated',
    })
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(church) })

    const { result } = renderHook(() => useSiteChurchProfile('c1'), {
      wrapper: Providers,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual(church)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches/c1')
  })

  it('does not fetch church profile when user session is absent', async () => {
    sessionMock.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    const { result } = renderHook(() => useSiteChurchProfile('c1'), {
      wrapper: Providers,
    })

    expect(result.current.loading).toBe(false)
    expect(axiosMock.get).not.toHaveBeenCalled()
  })
})

describe('useSiteChurchPrayers', () => {
  it('fetches prayers when session is present and churchId is provided', async () => {
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'u1' } },
      status: 'authenticated',
    })
    const mockPrayer = {
      id: 'p1',
      churchId: 'c1',
      publishedAt: '2026-10-15T00:00:00Z',
      version: {
        prayerVersionId: 'pv1',
        versionNumber: 1,
        pastorId: 'pas1',
        title: 'Peace in Uncertain Times',
        introduction: null,
        body: 'Text',
        languageCode: 'et',
      },
      audio: null,
    }
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet([mockPrayer], 1) })

    const { result } = renderHook(() => useSiteChurchPrayers('c1'), {
      wrapper: Providers,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual([mockPrayer])
    expect(result.current.total).toBe(1)
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches/c1/prayers?page=1&limit=10')
  })
})
