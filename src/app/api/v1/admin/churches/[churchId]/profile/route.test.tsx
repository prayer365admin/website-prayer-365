// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/church', () => ({ getChurchProfile: vi.fn(), patchChurchProfile: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getChurchProfile, patchChurchProfile } from '@/controller/church'
import { GeneralError } from '@/utils/general-error'
import { GET, PATCH } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}

const validInput = {
  version: 3,
  name: 'New Name',
  description: null,
  denomination: null,
  address: { line1: '1 St', city: 'X', countryCode: 'ID' },
  coordinates: null,
  timezone: 'Asia/Makassar',
  contacts: { email: 'a@b.com' },
  website: null,
  socialLinks: [],
  languageCodes: ['en'],
  coverAssetId: null,
}

const profile = { id: 'c1', name: 'New Name', version: 3 }

describe('GET /api/v1/admin/churches/[churchId]/profile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns profile (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(getChurchProfile).mockResolvedValue(profile as never)
    const res = (await GET(new NextRequest('http://x/profile'), params as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result.id).toBe('c1')
  })

  it('returns 403 when scope denied', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'No.',
      }),
    )
    const res = (await GET(new NextRequest('http://x/profile'), params as never))!
    expect(res.status).toBe(403)
  })

  it('hides an out-of-scope church as 404 (cross-church read denied)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Resource not found.',
      }),
    )
    const res = (await GET(new NextRequest('http://x/profile'), params as never))!
    expect(res.status).toBe(404)
    expect((await res.json()).error_code).toBe('RESOURCE_NOT_FOUND')
  })
})

describe('PATCH /api/v1/admin/churches/[churchId]/profile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates body and updates profile (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchChurchProfile).mockResolvedValue({ ...profile, version: 4 } as never)
    const req = new NextRequest('http://x/profile', {
      method: 'PATCH',
      body: JSON.stringify(validInput),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result.version).toBe(4)
    expect(patchChurchProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'c1',
        input: expect.objectContaining({ name: 'New Name' }),
      }),
    )
  })

  it('accepts churchStyle and clears it with null', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchChurchProfile).mockResolvedValue({ ...profile, version: 4 } as never)
    const set = new NextRequest('http://x/profile', {
      method: 'PATCH',
      body: JSON.stringify({ ...validInput, churchStyle: 'Contemporary Ecumenical' }),
    })
    const setRes = (await PATCH(set, params as never))!
    expect(setRes.status).toBe(200)
    expect(patchChurchProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ churchStyle: 'Contemporary Ecumenical' }),
      }),
    )

    const clear = new NextRequest('http://x/profile', {
      method: 'PATCH',
      body: JSON.stringify({ ...validInput, churchStyle: null }),
    })
    const clearRes = (await PATCH(clear, params as never))!
    expect(clearRes.status).toBe(200)
    expect(patchChurchProfile).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ churchStyle: null }) }),
    )
  })

  it('accepts an address without a country code (central-created churches)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchChurchProfile).mockResolvedValue({ ...profile, version: 4 } as never)
    const req = new NextRequest('http://x/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        ...validInput,
        address: { line1: '1 St', city: 'X' },
      }),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(200)
    expect(patchChurchProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ address: { line1: '1 St', city: 'X' } }),
      }),
    )
  })

  it('rejects server-owned fields with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/profile', {
      method: 'PATCH',
      body: JSON.stringify({ ...validInput, status: 'APPROVED', approved_at: '2026-01-01' }),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(422)
    expect((await res.json()).error_code).toBe('VALIDATION_ERROR')
  })

  it('rejects malformed coordinates / missing required fields with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/profile', {
      method: 'PATCH',
      body: JSON.stringify({ version: 3, name: 'X' }),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(422)
  })

  it('returns 409 when controller reports stale version', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchChurchProfile).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'stale',
      }),
    )
    const req = new NextRequest('http://x/profile', {
      method: 'PATCH',
      body: JSON.stringify(validInput),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(409)
    expect((await res.json()).error_code).toBe('STALE_VERSION')
  })

  it('denies a cross-church edit with 403 NOT_ALLOWED', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue({
      userId: 'u1',
      churchIds: new Set(['c2']),
      scope: { kind: 'church', orgNodeId: 'n1', name: '' },
    } as never)
    vi.mocked(patchChurchProfile).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'This account is not allowed for this church.',
      }),
    )
    const req = new NextRequest('http://x/profile', {
      method: 'PATCH',
      body: JSON.stringify(validInput),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('NOT_ALLOWED')
    expect(patchChurchProfile).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', churchIds: new Set(['c2']) }),
    )
  })
})
