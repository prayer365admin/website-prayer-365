import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  getMe: vi.fn(),
  patchMe: vi.fn(),
  listMyChurches: vi.fn(),
  setFollow: vi.fn(),
  createMobileAvatar: vi.fn(),
  getSetupProgress: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({
  getMe: m.getMe,
  patchMe: m.patchMe,
  listMyChurches: m.listMyChurches,
  setFollow: m.setFollow,
}))
vi.mock('@/controller/mobile-avatar', () => ({ createMobileAvatar: m.createMobileAvatar }))
vi.mock('@/controller/site', () => ({ getSetupProgress: m.getSetupProgress }))

import { PATCH as patchMeRoute } from './me/route'
import { GET as myChurches } from './me/churches/route'
import { PUT as followRoute, DELETE as unfollowRoute } from './me/follows/[churchId]/route'
import { POST as avatarRoute } from './me/avatar/route'
import { GET as setupProgressRoute } from './me/setup-progress/route'

const CHURCH = '0199c0de-0000-7000-8000-000000000001'
const session = { session: { user: { user_id: 'u1' } }, user: {} }
const json = (body: unknown) =>
  new NextRequest('http://localhost/api/v1/site/me', {
    method: 'POST',
    body: JSON.stringify(body),
  })
const ctx = { params: Promise.resolve({ churchId: CHURCH }) }

describe('website /me routes (WB-16, cookie session)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredWebAuth.mockResolvedValue(session)
  })

  it.each([
    ['PATCH me', () => patchMeRoute(json({ name: 'A' }))],
    ['GET churches', () => myChurches()],
    ['PUT follow', () => followRoute(json({}), ctx)],
    ['DELETE follow', () => unfollowRoute(json({}), ctx)],
    ['POST avatar', () => avatarRoute(json({ mimeType: 'image/png', byteSize: 10 }))],
    ['GET setup-progress', () => setupProgressRoute()],
  ])('%s returns 401 without a website session', async (_label, call) => {
    m.requiredWebAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    expect((await call()).status).toBe(401)
  })

  it("GET setup-progress returns the session user's onboarding progress, uncached", async () => {
    const progress = { churchStepDone: true, localeStepDone: false, completed: false }
    m.getSetupProgress.mockResolvedValue(progress)

    const res = await setupProgressRoute()

    expect(res.status).toBe(200)
    expect(m.getSetupProgress).toHaveBeenCalledWith({ userId: 'u1' })
    expect((await res.json()).result).toEqual(progress)
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('PATCH me updates the session user with a site locale and main church', async () => {
    m.patchMe.mockResolvedValue({ id: 'u1' })

    const res = await patchMeRoute(json({ locale: 'fi', mainChurchId: CHURCH }))

    expect(res.status).toBe(200)
    expect(m.patchMe).toHaveBeenCalledWith({
      userId: 'u1',
      data: { locale: 'fi', mainChurchId: CHURCH },
    })
  })

  it.each([
    ['clearing the locale', { locale: null }],
    ['a non-site locale', { locale: 'de' }],
    ['an unknown field', { role_id: 'admin' }],
  ])('PATCH me rejects %s with 422', async (_label, body) => {
    const res = await patchMeRoute(json(body))

    expect(res.status).toBe(422)
    expect(m.patchMe).not.toHaveBeenCalled()
  })

  it('PATCH me may clear the main church (R-07)', async () => {
    m.patchMe.mockResolvedValue({ id: 'u1' })

    const res = await patchMeRoute(json({ mainChurchId: null }))

    expect(res.status).toBe(200)
    expect(m.patchMe).toHaveBeenCalledWith({ userId: 'u1', data: { mainChurchId: null } })
  })

  it('PUT / DELETE follow toggle the follow for the session user', async () => {
    m.setFollow.mockResolvedValue({ churchId: CHURCH, isFollowed: true })

    await followRoute(json({}), ctx)
    await unfollowRoute(json({}), ctx)

    expect(m.setFollow).toHaveBeenNthCalledWith(1, {
      userId: 'u1',
      churchId: CHURCH,
      isFollowed: true,
    })
    expect(m.setFollow).toHaveBeenNthCalledWith(2, {
      userId: 'u1',
      churchId: CHURCH,
      isFollowed: false,
    })
  })

  it('POST avatar signs a user-scoped upload and rejects non-images', async () => {
    m.createMobileAvatar.mockResolvedValue({
      uploadUrl: 'u',
      fields: {},
      objectKey: 'k',
      expiresIn: 900,
    })

    expect((await avatarRoute(json({ mimeType: 'image/png', byteSize: 10 }))).status).toBe(200)
    expect(m.createMobileAvatar).toHaveBeenCalledWith({
      userId: 'u1',
      input: { mimeType: 'image/png', byteSize: 10 },
    })
    expect((await avatarRoute(json({ mimeType: 'text/html', byteSize: 10 }))).status).toBe(422)
  })
})
