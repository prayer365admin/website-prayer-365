// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/controller/mobile', () => ({
  checkIn: vi.fn(),
  getHome: vi.fn(),
  getMe: vi.fn(),
  getPublicChurch: vi.fn(),
  getPublishedPrayer: vi.fn(),
  listPublicChurches: vi.fn(),
  patchMe: vi.fn(),
  recordAnalyticsEvents: vi.fn(),
  setFollow: vi.fn(),
  submitRequest: vi.fn(),
}))
vi.mock('@/controller/mobile-avatar', () => ({ createMobileAvatar: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import {
  checkIn,
  getHome,
  getMe,
  getPublicChurch,
  patchMe,
  recordAnalyticsEvents,
  setFollow,
  submitRequest,
} from '@/controller/mobile'
import { createMobileAvatar } from '@/controller/mobile-avatar'
import { GeneralError } from '@/utils/general-error'
import { GET as GET_CHURCHES } from './churches/route'
import { GET as GET_CHURCH_PROFILE } from './churches/[churchId]/route'
import { GET as GET_ME, PATCH as PATCH_ME } from './me/route'
import { POST as POST_AVATAR } from './me/avatar/route'
import { PUT as PUT_FOLLOW } from './me/follows/[churchId]/route'
import { POST as POST_REQUEST } from './churches/[churchId]/requests/route'
import { POST as POST_CHECKIN } from './churches/[churchId]/check-ins/route'
import { POST as POST_ANALYTICS } from './analytics-events/route'
import { GET as GET_HOME } from './home/route'

const authUser = (userId: string) => () => ({ session: { user: { user_id: userId } } })

const churchParams = { params: Promise.resolve({ churchId: 'c1' }) }

const UNAUTH = new GeneralError({
  code: 401,
  error: 'Not Authenticated!',
  error_code: 'UNAUTHORIZED',
  details: 'Please login and try again!',
})

beforeEach(() => vi.clearAllMocks())

describe('discovery & live gating', () => {
  it('GET /mobile/churches requires authentication (401)', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)
    const res = (await GET_CHURCHES(new NextRequest('http://x/churches')))!
    expect(res.status).toBe(401)
  })

  it('cross-user is structurally blocked: me uses ONLY the session user', async () => {
    // A forged caller identity (user "attacker") cannot steer the subject.
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(getMe).mockResolvedValue({ id: 'u1' } as never)
    const res = (await GET_ME(new NextRequest('http://x/me')))!
    expect(res.status).toBe(200)
    expect(getMe).toHaveBeenCalledWith({ userId: 'u1' })
    expect(getMe).not.toHaveBeenCalledWith({ userId: 'attacker' })
  })

  it('PATCH /me sets the main church (single-row via controller)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(patchMe).mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      locale: null,
      profilePicture: null,
      mainChurchId: 'c2',
    } as never)
    const req = new NextRequest('http://x/me', {
      method: 'PATCH',
      body: JSON.stringify({ mainChurchId: '00000000-0000-4000-8000-000000000002' }),
    })
    const res = (await PATCH_ME(req))!
    expect(res.status).toBe(200)
    expect(patchMe).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        data: { mainChurchId: '00000000-0000-4000-8000-000000000002' },
      }),
    )
  })

  it('PATCH /me passes a nullable profilePicture through to the controller', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(patchMe).mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      locale: null,
      profilePicture: 'https://cdn.example.com/a.png',
      mainChurchId: null,
    } as never)
    const req = new NextRequest('http://x/me', {
      method: 'PATCH',
      body: JSON.stringify({ profilePicture: 'https://cdn.example.com/a.png' }),
    })
    const res = (await PATCH_ME(req))!
    expect(res.status).toBe(200)
    expect(patchMe).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        data: { profilePicture: 'https://cdn.example.com/a.png' },
      }),
    )
  })

  it('PATCH /me rejects a non-URL profilePicture as 422 (never reaches the controller)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    const req = new NextRequest('http://x/me', {
      method: 'PATCH',
      body: JSON.stringify({ profilePicture: 'not-a-url' }),
    })
    const res = (await PATCH_ME(req))!
    expect(res.status).toBe(422)
    expect(patchMe).not.toHaveBeenCalled()
  })

  it('PUT /me/follows/:churchId follows via the session user', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(setFollow).mockResolvedValue({ churchId: 'c1', isFollowed: true } as never)
    const res = (await PUT_FOLLOW(new NextRequest('http://x/follows/c1'), churchParams as never))!
    expect(res.status).toBe(200)
    expect(setFollow).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', churchId: 'c1', isFollowed: true }),
    )
  })

  it('PUT /me/follows/:churchId hides a non-approved church as 404', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(setFollow).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Church not found or not available.',
      }),
    )
    const res = (await PUT_FOLLOW(new NextRequest('http://x/follows/c-sus'), {
      params: Promise.resolve({ churchId: 'c-sus' }),
    } as never))!
    expect(res.status).toBe(404)
  })
})

describe('avatar — user-scoped signed upload, image-only', () => {
  it('signs the upload for the SESSION user (subject-only)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(createMobileAvatar).mockResolvedValue({
      uploadUrl: 'https://s3/upload',
      fields: { key: 'k' },
      objectKey: 'user-avatars/u1/x.png',
      expiresIn: 900,
    } as never)
    const req = new NextRequest('http://x/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ mimeType: 'image/png', byteSize: 2048 }),
    })
    const res = (await POST_AVATAR(req))!
    expect(res.status).toBe(200)
    expect(createMobileAvatar).toHaveBeenCalledWith({
      userId: 'u1',
      input: { mimeType: 'image/png', byteSize: 2048 },
    })
  })

  it('rejects a non-image MIME as 422 (never reaches the controller)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    const req = new NextRequest('http://x/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ mimeType: 'application/pdf', byteSize: 10 }),
    })
    const res = (await POST_AVATAR(req))!
    expect(res.status).toBe(422)
    expect(createMobileAvatar).not.toHaveBeenCalled()
  })

  it('rejects an oversize image as 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    const req = new NextRequest('http://x/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ mimeType: 'image/png', byteSize: 9 * 1024 * 1024 }),
    })
    const res = (await POST_AVATAR(req))!
    expect(res.status).toBe(422)
    expect(createMobileAvatar).not.toHaveBeenCalled()
  })

  it('ignores a forged userId in the body (strict schema)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    const req = new NextRequest('http://x/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ mimeType: 'image/png', byteSize: 10, userId: 'attacker' }),
    })
    const res = (await POST_AVATAR(req))!
    expect(res.status).toBe(422)
    expect(createMobileAvatar).not.toHaveBeenCalled()
  })

  it('requires authentication (401)', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)
    const req = new NextRequest('http://x/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ mimeType: 'image/png', byteSize: 10 }),
    })
    const res = (await POST_AVATAR(req))!
    expect(res.status).toBe(401)
  })
})

describe('requests — subject requirement + idempotent ack', () => {
  it('rejects a non-allowlisted request kind as 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    const req = new NextRequest('http://x/requests', {
      method: 'POST',
      body: JSON.stringify({ kind: 'sneaky', message: 'hi', contactMethod: 'in_app' }),
    })
    const res = (await POST_REQUEST(req, churchParams as never))!
    expect(res.status).toBe(422)
    expect(submitRequest).not.toHaveBeenCalled()
  })

  it('acknowledges a valid request and passes the Idempotency-Key through', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(submitRequest).mockResolvedValue({
      id: 'req-1',
      kind: 'pastoral',
      createdAt: '2026-01-01T00:00:00Z',
    } as never)
    const req = new NextRequest('http://x/requests', {
      method: 'POST',
      headers: { 'idempotency-key': 'k1' },
      body: JSON.stringify({ kind: 'pastoral', message: 'hi', contactMethod: 'in_app' }),
    })
    const res = (await POST_REQUEST(req, churchParams as never))!
    expect(res.status).toBe(200)
    expect(submitRequest).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'k1' }))
  })
})

describe('check-ins', () => {
  it('records a check-in for the session user', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(checkIn).mockResolvedValue({
      id: 'ck-1',
      churchId: 'c1',
      occurredAt: '2026-01-01T00:00:00Z',
      localDate: '2026-01-01',
    } as never)
    const req = new NextRequest('http://x/check-ins', { method: 'POST', body: JSON.stringify({}) })
    const res = (await POST_CHECKIN(req, churchParams as never))!
    expect(res.status).toBe(200)
    expect(checkIn).toHaveBeenCalledWith(expect.objectContaining({ churchId: 'c1', userId: 'u1' }))
  })
})

describe('analytics — allowlist enforced at the route boundary', () => {
  it('rejects a non-allowlisted event type with 422 (never reaches the controller)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    const req = new NextRequest('http://x/analytics-events', {
      method: 'POST',
      body: JSON.stringify({
        events: [{ eventType: 'steal-data', occurredAt: '2026-01-01T00:00:00Z' }],
      }),
    })
    const res = (await POST_ANALYTICS(req))!
    expect(res.status).toBe(422)
    expect(recordAnalyticsEvents).not.toHaveBeenCalled()
  })

  it('accepts an allowlisted batch', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(recordAnalyticsEvents).mockResolvedValue({ accepted: 1 } as never)
    const req = new NextRequest('http://x/analytics-events', {
      method: 'POST',
      body: JSON.stringify({
        events: [{ eventType: 'app_open', occurredAt: '2026-01-01T00:00:00Z' }],
      }),
    })
    const res = (await POST_ANALYTICS(req))!
    expect(res.status).toBe(200)
    expect(recordAnalyticsEvents).toHaveBeenCalled()
  })
})

describe('home — MB-10 typed projection', () => {
  it('GET /mobile/home requires authentication (401)', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)
    const res = (await GET_HOME(new NextRequest('http://x/home')))!
    expect(res.status).toBe(401)
  })

  it('returns mainChurch/followedChurches + the three typed arrays', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(getHome).mockResolvedValue({
      mainChurch: { id: 'c1' },
      followedChurches: [{ id: 'c2' }],
      latestPrayers: [],
      latestEvents: [],
      latestAnnouncements: [],
    } as never)

    const res = (await GET_HOME(new NextRequest('http://x/home')))!
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.result.mainChurch.id).toBe('c1')
    expect(body.result.followedChurches).toHaveLength(1)
    expect(body.result.latestPrayers).toEqual([])
    expect(body.result.latestEvents).toEqual([])
    expect(body.result.latestAnnouncements).toEqual([])
    expect(body.result).not.toHaveProperty('main')
    expect(getHome).toHaveBeenCalledWith({ userId: 'u1' })
  })
})

describe('church profile — identifier passthrough (the app sends a UUID, links send a slug)', () => {
  it('GET /mobile/churches/:churchId requires authentication (401)', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)
    const res = (await GET_CHURCH_PROFILE(new NextRequest('http://x/churches/c1'), churchParams))!
    expect(res.status).toBe(401)
  })

  it('passes the route segment through as the church id — never rewritten or slugified', async () => {
    const uuid = '01a0f73b-7860-75cc-a58d-febcab0ac0f7'
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(getPublicChurch).mockResolvedValue({ id: uuid, name: 'Tallinn Demo Church' } as never)

    const res = (await GET_CHURCH_PROFILE(new NextRequest(`http://x/churches/${uuid}`), {
      params: Promise.resolve({ churchId: uuid }),
    }))!
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.result.id).toBe(uuid)
    expect(getPublicChurch).toHaveBeenCalledWith({ churchId: uuid, query: { page: 1, limit: 25 } })
  })

  it('answers 404 when the church is not resolvable (the pre-fix behaviour for every UUID)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(authUser('u1')() as never)
    vi.mocked(getPublicChurch).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Church not found or not available.',
      }),
    )

    const res = (await GET_CHURCH_PROFILE(new NextRequest('http://x/churches/missing'), {
      params: Promise.resolve({ churchId: 'missing' }),
    }))!

    expect(res.status).toBe(404)
  })
})
