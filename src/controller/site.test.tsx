import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ GET_ME_PROFILE: vi.fn() }))
vi.mock('@/providers/mobile', () => ({ GET_ME_PROFILE: m.GET_ME_PROFILE }))

import { getSetupProgress } from './site'

const me = (over: Record<string, unknown>) => ({
  id: 'u1',
  locale: null,
  mainChurchId: null,
  churchSetupCompletedAt: null,
  localeSetupCompletedAt: null,
  ...over,
})

describe('getSetupProgress (WB-15, stored on the account)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fresh account: parish step pending, not completed', async () => {
    m.GET_ME_PROFILE.mockResolvedValue(me({}))

    expect(await getSetupProgress({ userId: 'u1' })).toEqual({
      churchStepDone: false,
      localeStepDone: false,
      completed: false,
    })
  })

  it('parish skipped on another device: step done from church_setup_completed_at', async () => {
    m.GET_ME_PROFILE.mockResolvedValue(me({ churchSetupCompletedAt: new Date() }))

    expect((await getSetupProgress({ userId: 'u1' })).churchStepDone).toBe(true)
  })

  it('a main church also counts as the parish step done', async () => {
    m.GET_ME_PROFILE.mockResolvedValue(me({ mainChurchId: 'c1' }))

    expect((await getSetupProgress({ userId: 'u1' })).churchStepDone).toBe(true)
  })

  it('a skipped language (default locale saved, no timestamp) is not filled', async () => {
    m.GET_ME_PROFILE.mockResolvedValue(me({ locale: 'en        ' }))

    expect((await getSetupProgress({ userId: 'u1' })).localeStepDone).toBe(false)
  })

  it('a filled language alone is not completed: the parish step is still pending', async () => {
    m.GET_ME_PROFILE.mockResolvedValue(me({ locale: 'sv', localeSetupCompletedAt: new Date() }))

    expect(await getSetupProgress({ userId: 'u1' })).toEqual({
      churchStepDone: false,
      localeStepDone: true,
      completed: false,
    })
  })

  it('completed once both steps are filled', async () => {
    m.GET_ME_PROFILE.mockResolvedValue(
      me({ churchSetupCompletedAt: new Date(), localeSetupCompletedAt: new Date() }),
    )

    expect((await getSetupProgress({ userId: 'u1' })).completed).toBe(true)
  })

  it('404 for an unknown user', async () => {
    m.GET_ME_PROFILE.mockResolvedValue(null)

    await expect(getSetupProgress({ userId: 'x' })).rejects.toMatchObject({ code: 404 })
  })
})
