// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/prayer', () => ({ createPrayer: vi.fn(), listPrayers: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { createPrayer, listPrayers } from '@/controller/prayer'
import { GeneralError } from '@/utils/general-error'
import { GET, POST } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const churchParams = { params: Promise.resolve({ churchId: 'c1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}

const valid = {
  title: 'My Prayer',
  introduction: null,
  body: 'Amen.',
  pastorId: '00000000-0000-4000-8000-000000000002',
  languageCode: 'en',
}

describe('GET /api/v1/admin/churches/[churchId]/prayers', () => {
  beforeEach(() => vi.clearAllMocks())
  it('lists prayers scoped to the church (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(listPrayers).mockResolvedValue({ result: [], total: 0 } as never)
    const res = (await GET(new NextRequest('http://x/prayers?limit=10'), churchParams as never))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.limit).toBe(10)
    expect(body.request_id).toBeTruthy()
  })

  it('returns 403 when the scope is denied', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'No.',
      }),
    )
    const res = (await GET(new NextRequest('http://x/prayers'), churchParams as never))!
    expect(res.status).toBe(403)
  })
})

describe('POST /api/v1/admin/churches/[churchId]/prayers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a prayer with initial version (201)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(createPrayer).mockResolvedValue({ id: 'p1', churchId: 'c1', version: 1 } as never)
    const req = new NextRequest('http://x/prayers', { method: 'POST', body: JSON.stringify(valid) })
    const res = (await POST(req, churchParams as never))!
    expect(res.status).toBe(201)
    expect((await res.json()).result.id).toBe('p1')
    expect(createPrayer).toHaveBeenCalledWith(expect.objectContaining({ churchId: 'c1' }))
  })

  it('rejects a body without a title with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/prayers', {
      method: 'POST',
      body: JSON.stringify({ ...valid, title: '' }),
    })
    const res = (await POST(req, churchParams as never))!
    expect(res.status).toBe(422)
  })
})
