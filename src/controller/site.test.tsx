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

  // Plan 026: the card is decorative, and a refused connection is a capacity blip.
  it('returns null instead of failing the page when a parish refuses the connection (P2037)', async () => {
    m.LIST_PUBLIC_CHURCHES.mockResolvedValue({
      result: [{ id: 'c2', slug: 'near', name: 'Near', coverUrl: null, distanceKm: 2 }],
      total: 1,
    })
    m.LIST_PUBLISHED_PRAYERS.mockRejectedValue(
      Object.assign(new Error('Too many database connections opened'), { code: 'P2037' }),
    )

    await expect(
      getNeighborSpotlight({ churchId: 'c1', coordinates: { latitude: 59.43, longitude: 24.75 } }),
    ).resolves.toBeNull()
  })

  it('still throws when the parish read fails for a real reason', async () => {
    m.LIST_PUBLIC_CHURCHES.mockResolvedValue({
      result: [{ id: 'c2', slug: 'near', name: 'Near', coverUrl: null, distanceKm: 2 }],
      total: 1,
    })
    m.LIST_PUBLISHED_PRAYERS.mockRejectedValue(new Error('relation "prayer" does not exist'))

    await expect(
      getNeighborSpotlight({ churchId: 'c1', coordinates: { latitude: 59.43, longitude: 24.75 } }),
    ).rejects.toThrow('relation "prayer" does not exist')
  })

  it('probes at most two neighbours (the list arrives distance-sorted)', async () => {
    m.LIST_PUBLIC_CHURCHES.mockResolvedValue({
      result: [
        { id: 'c2', slug: 'a', name: 'A', coverUrl: null, distanceKm: 2 },
        { id: 'c3', slug: 'b', name: 'B', coverUrl: null, distanceKm: 4 },
        { id: 'c4', slug: 'c', name: 'C', coverUrl: null, distanceKm: 6 },
      ],
      total: 3,
    })
    m.LIST_PUBLISHED_PRAYERS.mockResolvedValue({ result: [], total: 0 })

    await expect(
      getNeighborSpotlight({ churchId: 'c1', coordinates: { latitude: 59.43, longitude: 24.75 } }),
    ).resolves.toBeNull()
    expect(m.LIST_PUBLISHED_PRAYERS).toHaveBeenCalledTimes(2)
  })
})
