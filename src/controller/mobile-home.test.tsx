import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The home screen's lead prayer is a product rule, not a client decision
 * (client note, 13 Nov 2026):
 *   selected church with a published prayer -> that church's prayer
 *   no church, or no published church prayer -> the platform daily prayer
 *   neither                                  -> null
 *
 * Both the app and the website render `featuredPrayer`, so this rule is the only
 * place the priority can drift.
 */
const m = vi.hoisted(() => ({
  GET_HOME: vi.fn(),
  getMobileGeneralPrayer: vi.fn(),
}))

vi.mock('@/providers/mobile', () => ({ GET_HOME: m.GET_HOME }))
// controller/mobile imports the login controller, which pulls next-auth (needs next/server).
vi.mock('@/controller/authentication', () => ({ loginUser: vi.fn() }))
vi.mock('@/controller/general-prayer', () => ({
  getMobileGeneralPrayer: m.getMobileGeneralPrayer,
}))

import { getHome } from './mobile'

const churchPrayer = (id: string, churchId: string) =>
  ({
    id,
    churchId,
    slug: `prayer-${id}`,
  }) as never

const generalPrayer = { slug: 'paivapalve-3', sequence: 3 } as never

const homeFixture = (overrides: Record<string, unknown> = {}) =>
  ({
    mainChurch: null,
    followedChurches: [],
    latestPrayers: [],
    latestEvents: [],
    latestAnnouncements: [],
    ...overrides,
  }) as never

describe('getHome featuredPrayer priority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.getMobileGeneralPrayer.mockResolvedValue(null)
  })

  it("leads with the selected church's own prayer, even when a followed church published later", async () => {
    m.GET_HOME.mockResolvedValue(
      homeFixture({
        mainChurch: { id: 'church-main' },
        latestPrayers: [
          churchPrayer('newer-followed', 'church-followed'),
          churchPrayer('main-prayer', 'church-main'),
        ],
      }),
    )

    const home = await getHome({ userId: 'u1' })

    expect(home.featuredPrayer).toEqual({
      type: 'church',
      prayer: expect.objectContaining({ id: 'main-prayer' }),
    })
    expect(m.getMobileGeneralPrayer).not.toHaveBeenCalled()
  })

  it('falls back to the daily prayer when the selected church has nothing published', async () => {
    m.GET_HOME.mockResolvedValue(
      homeFixture({
        mainChurch: { id: 'church-main' },
        latestPrayers: [churchPrayer('followed-only', 'church-followed')],
      }),
    )
    m.getMobileGeneralPrayer.mockResolvedValue(generalPrayer)

    const home = await getHome({ userId: 'u1' })

    expect(home.featuredPrayer).toEqual({ type: 'general', prayer: generalPrayer })
  })

  it('leads with the daily prayer when no church is selected', async () => {
    m.GET_HOME.mockResolvedValue(homeFixture({ latestPrayers: [churchPrayer('x', 'c2')] }))
    m.getMobileGeneralPrayer.mockResolvedValue(generalPrayer)

    const home = await getHome({ userId: 'u1' })

    expect(home.featuredPrayer).toEqual({ type: 'general', prayer: generalPrayer })
  })

  it('returns null when neither a church prayer nor a daily prayer exists', async () => {
    m.GET_HOME.mockResolvedValue(homeFixture())

    const home = await getHome({ userId: 'u1' })

    expect(home.featuredPrayer).toBeNull()
  })

  it('does not fail the home payload when the daily prayer read throws', async () => {
    m.GET_HOME.mockResolvedValue(homeFixture())
    m.getMobileGeneralPrayer.mockRejectedValue(new Error('cache miss'))

    const home = await getHome({ userId: 'u1' })

    expect(home.featuredPrayer).toBeNull()
    expect(home.mainChurch).toBeNull()
  })
})
