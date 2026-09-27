// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/prayer', () => ({ getPrayer: vi.fn(), patchPrayer: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getPrayer, patchPrayer } from '@/controller/prayer'
import { GeneralError } from '@/utils/general-error'
import { GET, PATCH } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1', prayerId: 'p1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}

const edit = {
  version: 3,
  title: 'Updated',
  introduction: null,
  body: 'Amen.',
  pastorId: '00000000-0000-4000-8000-000000000002',
  languageCode: 'en',
}

describe('GET prayers/:prayerId', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns a prayer (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(getPrayer).mockResolvedValue({ id: 'p1', churchId: 'c1' } as never)
    const res = (await GET(new NextRequest('http://x/prayers/p1'), params as never))!
    expect(res.status).toBe(200)
  })
  it('returns 404 for an out-of-scope prayer', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(getPrayer).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'nope',
      }),
    )
    const res = (await GET(new NextRequest('http://x/prayers/p9'), params as never))!
    expect(res.status).toBe(404)
  })
})

describe('PATCH prayers/:prayerId', () => {
  beforeEach(() => vi.clearAllMocks())
  it('creates a new version snapshot (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchPrayer).mockResolvedValue({ id: 'p1', version: 4 } as never)
    const req = new NextRequest('http://x/prayers/p1', {
      method: 'PATCH',
      body: JSON.stringify(edit),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(200)
    expect(patchPrayer).toHaveBeenCalledWith(expect.objectContaining({ prayerId: 'p1' }))
  })
  it('returns 409 on stale version', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchPrayer).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'stale',
      }),
    )
    const req = new NextRequest('http://x/prayers/p1', {
      method: 'PATCH',
      body: JSON.stringify(edit),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(409)
  })
  it('rejects a PATCH without version with 422 (from controller)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchPrayer).mockRejectedValue(
      new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'VERSION_REQUIRED',
        details: 'version required',
      }),
    )
    const req = new NextRequest('http://x/prayers/p1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'x', body: 'y', pastorId: edit.pastorId, languageCode: 'en' }),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(422)
  })
})
