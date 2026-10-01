// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/service-time', () => ({
  getServiceTimes: vi.fn(),
  replaceServiceTimes: vi.fn(),
}))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getServiceTimes, replaceServiceTimes } from '@/controller/service-time'
import { GeneralError } from '@/utils/general-error'
import { GET, PUT } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}

describe('GET /api/v1/admin/churches/[churchId]/service-times', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the schedule (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(getServiceTimes).mockResolvedValue([
      { id: 's1', weekday: 1, localTime: '09:00:00', label: 'Sun', languageCode: 'en' },
    ] as never)
    const res = (await GET(new NextRequest('http://x/service-times'), params as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result).toHaveLength(1)
    expect(getServiceTimes).toHaveBeenCalledWith({
      churchId: 'c1',
      churchIds: new Set(['c1']),
    })
  })

  it('returns 404 when church out of scope', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'nope',
      }),
    )
    const res = (await GET(new NextRequest('http://x/service-times'), params as never))!
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/v1/admin/churches/[churchId]/service-times', () => {
  beforeEach(() => vi.clearAllMocks())

  const schedule = {
    version: 3,
    schedule: [{ weekday: 1, localTime: '09:00:00', label: 'Mass', languageCode: 'en' }],
  }

  it('validates and replaces the schedule (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(replaceServiceTimes).mockResolvedValue({ count: 1 } as never)
    const req = new NextRequest('http://x/service-times', {
      method: 'PUT',
      body: JSON.stringify(schedule),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result.count).toBe(1)
  })

  it('rejects an out-of-range weekday with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/service-times', {
      method: 'PUT',
      body: JSON.stringify({ version: 3, schedule: [{ weekday: 8, localTime: '09:00:00' }] }),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(422)
  })

  it('rejects a malformed time with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/service-times', {
      method: 'PUT',
      body: JSON.stringify({ version: 3, schedule: [{ weekday: 1, localTime: '25:99' }] }),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(422)
  })

  it('returns 409 when controller reports stale version', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(replaceServiceTimes).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'stale',
      }),
    )
    const req = new NextRequest('http://x/service-times', {
      method: 'PUT',
      body: JSON.stringify(schedule),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(409)
  })

  it('denies a cross-church edit with 403 NOT_ALLOWED', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue({
      userId: 'u1',
      churchIds: new Set(['c2']),
      scope: { kind: 'church', orgNodeId: 'n1', name: '' },
    } as never)
    vi.mocked(replaceServiceTimes).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'This account is not allowed for this church.',
      }),
    )
    const req = new NextRequest('http://x/service-times', {
      method: 'PUT',
      body: JSON.stringify({ version: 3, schedule: [] }),
    })
    const res = (await PUT(req, params as never))!
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('NOT_ALLOWED')
    expect(replaceServiceTimes).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', churchIds: new Set(['c2']) }),
    )
  })
})
