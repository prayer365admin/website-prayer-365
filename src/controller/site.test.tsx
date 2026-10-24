// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  GET_ME_PROFILE: vi.fn(),
  LIST_PUBLIC_CHURCHES: vi.fn(),
  LIST_PUBLISHED_PRAYERS: vi.fn(),
}))

vi.mock('@/providers/mobile', () => ({
  GET_ME_PROFILE: m.GET_ME_PROFILE,
  LIST_PUBLIC_CHURCHES: m.LIST_PUBLIC_CHURCHES,
  LIST_PUBLISHED_PRAYERS: m.LIST_PUBLISHED_PRAYERS,
}))

import { getNeighborSpotlight } from './site'

describe('getNeighborSpotlight (W11 spotlight)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when the church has no coordinates', async () => {
    const res = await getNeighborSpotlight({ churchId: 'c1', coordinates: null })
    expect(res).toBeNull()
    expect(m.LIST_PUBLIC_CHURCHES).not.toHaveBeenCalled()
  })

  it('skips the beneficiary and churches without prayers to find the nearest neighbour with one', async () => {
    m.LIST_PUBLIC_CHURCHES.mockResolvedValue({
      result: [
        { id: 'c1', slug: 'self', name: 'Self Church' },
        { id: 'c2', slug: 'empty-church', name: 'Empty Church', coverUrl: null, distanceKm: 5 },
        {
          id: 'c3',
          slug: 'st-mary',
          name: "St. Mary's",
          coverUrl: 'https://cdn.test/mary.jpg',
          distanceKm: 12.4,
        },
      ],
      total: 3,
    })
    // c2 has no published prayers; c3 has one
    m.LIST_PUBLISHED_PRAYERS.mockResolvedValueOnce({ result: [], total: 0 }).mockResolvedValueOnce({
      result: [
        {
          id: 'p1',
          churchId: 'c3',
          churchName: "St. Mary's",
          publishedAt: '2026-10-01T00:00:00Z',
          version: {
            prayerVersionId: 'pv1',
            versionNumber: 1,
            pastorId: 'pastor1',
            pastorName: 'Pastor Joel',
            title: 'Morning Prayer',
            introduction: null,
            body: 'Lord uphold us in peace.',
            languageCode: 'en',
          },
          audio: null,
        },
      ],
      total: 1,
    })

    const res = await getNeighborSpotlight({
      churchId: 'c1',
      coordinates: { latitude: 59.43, longitude: 24.75 },
    })

    expect(m.LIST_PUBLIC_CHURCHES).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ latitude: 59.43, longitude: 24.75 }),
      }),
    )
    expect(m.LIST_PUBLISHED_PRAYERS).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c2' }),
    )
    expect(m.LIST_PUBLISHED_PRAYERS).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c3' }),
    )
    expect(res).toEqual({
      churchId: 'c3',
      slug: 'st-mary',
      churchName: "St. Mary's",
      coverUrl: 'https://cdn.test/mary.jpg',
      distanceKm: 12.4,
      prayer: {
        id: 'p1',
        title: 'Morning Prayer',
        body: 'Lord uphold us in peace.',
        pastorName: 'Pastor Joel',
        churchName: "St. Mary's",
      },
    })
  })

  it('returns null when no nearby neighbour has any published prayers', async () => {
    m.LIST_PUBLIC_CHURCHES.mockResolvedValue({
      result: [{ id: 'c2', slug: 'empty', name: 'Empty', coverUrl: null, distanceKm: 2 }],
      total: 1,
    })
    m.LIST_PUBLISHED_PRAYERS.mockResolvedValueOnce({ result: [], total: 0 })

    const res = await getNeighborSpotlight({
      churchId: 'c1',
      coordinates: { latitude: 59.43, longitude: 24.75 },
    })

    expect(res).toBeNull()
  })
})
