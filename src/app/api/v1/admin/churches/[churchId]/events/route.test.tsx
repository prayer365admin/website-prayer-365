// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { createEvent, listEvents, patchEvent } from '@/controller/event'
import { GeneralError } from '@/utils/general-error'
import { GET, POST } from './route'
import { PATCH } from './[eventId]/route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/event', () => ({
  createEvent: vi.fn(),
  listEvents: vi.fn(),
  patchEvent: vi.fn(),
}))

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const churchParams = { params: Promise.resolve({ churchId: 'c1' }) }
const eventParams = { params: Promise.resolve({ churchId: 'c1', eventId: 'e1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}

const valid = {
  category: 'SERVICE',
  title: 'Sunday',
  description: 'x',
  startsAt: '2026-10-01T10:00:00Z',
  location: 'Hall',
  registrationUrl: 'https://example.com/reg',
  languageCode: null,
}

describe('GET events', () => {
  beforeEach(() => vi.clearAllMocks())
  it('lists events (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(listEvents).mockResolvedValue({ result: [], total: 0 } as never)
    const res = (await GET(new NextRequest('http://x/events'), churchParams as never))!
    expect(res.status).toBe(200)
  })
})

describe('POST events — validation', () => {
  beforeEach(() => vi.clearAllMocks())
  it('creates an event (201) with a valid category/date/url', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(createEvent).mockResolvedValue({ id: 'e1', category: 'SERVICE' } as never)
    const req = new NextRequest('http://x/events', { method: 'POST', body: JSON.stringify(valid) })
    const res = (await POST(req, churchParams as never))!
    expect(res.status).toBe(201)
  })

  it('rejects an invalid category with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/events', {
      method: 'POST',
      body: JSON.stringify({ ...valid, category: 'CONCERT' }),
    })
    const res = (await POST(req, churchParams as never))!
    expect(res.status).toBe(422)
  })

  it('rejects an ambiguous (offset-less) startsAt with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/events', {
      method: 'POST',
      body: JSON.stringify({ ...valid, startsAt: '2026-10-01T10:00:00' }),
    })
    const res = (await POST(req, churchParams as never))!
    expect(res.status).toBe(422)
  })

  it('rejects a non-https registrationUrl with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/events', {
      method: 'POST',
      body: JSON.stringify({ ...valid, registrationUrl: 'http://example.com/reg' }),
    })
    const res = (await POST(req, churchParams as never))!
    expect(res.status).toBe(422)
  })
})

describe('PATCH events/:eventId', () => {
  beforeEach(() => vi.clearAllMocks())
  it('updates an event (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchEvent).mockResolvedValue({ id: 'e1', version: 4 } as never)
    const req = new NextRequest('http://x/events/e1', {
      method: 'PATCH',
      body: JSON.stringify({ ...valid, version: 3 }),
    })
    const res = (await PATCH(req, eventParams as never))!
    expect(res.status).toBe(200)
  })

  it('returns 409 on stale version', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchEvent).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'stale',
      }),
    )
    const req = new NextRequest('http://x/events/e1', {
      method: 'PATCH',
      body: JSON.stringify({ ...valid, version: 3 }),
    })
    const res = (await PATCH(req, eventParams as never))!
    expect(res.status).toBe(409)
  })
})
