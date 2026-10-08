// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/controller/request', () => ({ resolveRequestReadScope: vi.fn(), listRequests: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { resolveRequestReadScope, listRequests } from '@/controller/request'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const churchParams = { params: Promise.resolve({ churchId: 'c1' }) }
const scope = { churchIds: new Set(['c1']) }

const req = (query = '') => new NextRequest(`http://x/requests${query}`)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/v1/admin/churches/[churchId]/requests', () => {
  it('private reader sees private + standard rows with correct total (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(resolveRequestReadScope).mockResolvedValue(scope as never)
    vi.mocked(listRequests).mockResolvedValue({
      result: [
        {
          id: 'r1',
          kind: 'prayer',
          subject: 'S',
          classification: 'private',
          contactMethod: 'phone',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'r2',
          kind: 'prayer',
          subject: 'S2',
          classification: 'standard',
          contactMethod: 'email',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 2,
    } as never)
    const res = (await GET(req(), churchParams as never))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('standard reader sees standard rows only; count does not reveal private', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(resolveRequestReadScope).mockResolvedValue(scope as never)
    // Controller/provider apply the private filter BEFORE count/pagination.
    vi.mocked(listRequests).mockResolvedValue({
      result: [
        {
          id: 'r2',
          kind: 'prayer',
          subject: 'S2',
          classification: 'standard',
          contactMethod: 'email',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
    } as never)
    const res = (await GET(req(), churchParams as never))!
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.result).toHaveLength(1)
    expect(body.result[0].classification).toBe('standard')
  })

  it('returns 404 for a cross-church church (existence hidden)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(resolveRequestReadScope).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'nope',
      }),
    )
    const res = (await GET(req(), churchParams as never))!
    expect(res.status).toBe(404)
    expect(listRequests).not.toHaveBeenCalled()
  })

  it('returns 401 without authentication', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'login',
      }),
    )
    const res = (await GET(req(), churchParams as never))!
    expect(res.status).toBe(401)
  })

  it('rejects a non-allowlisted kind with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const res = (await GET(req('?kind=weekend'), churchParams as never))!
    expect(res.status).toBe(422)
    expect(listRequests).not.toHaveBeenCalled()
  })

  it('accepts a comma list of kinds (S10 pastoral/meeting tab)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(resolveRequestReadScope).mockResolvedValue(scope as never)
    vi.mocked(listRequests).mockResolvedValue({ result: [], total: 0 } as never)
    const res = (await GET(req('?kind=pastoral,meeting'), churchParams as never))!
    expect(res.status).toBe(200)
    expect(listRequests).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['pastoral', 'meeting'] }),
    )
  })

  it('rejects a list with any non-allowlisted kind with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    for (const kind of ['prayer,foo', 'PRIVATE', '']) {
      const res = (await GET(req(`?kind=${kind}`), churchParams as never))!
      expect(res.status).toBe(422)
    }
    expect(listRequests).not.toHaveBeenCalled()
  })
})
