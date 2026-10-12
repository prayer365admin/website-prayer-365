import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'
import { ParsedListQuery } from '@/utils/pagination'

vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/providers/request', () => ({ GET_REQUESTS: vi.fn(), GET_REQUEST: vi.fn() }))

import { requiredScope } from '@/utils/required-scope'
import { GET_REQUESTS, GET_REQUEST } from '@/providers/request'
import { resolveRequestReadScope, listRequests, getRequestDetail } from './request'

const query: ParsedListQuery = {
  page: 1,
  limit: 25,
  order_by: 'created_at',
  order_direction: 'desc',
}
const privateRow = {
  id: 'r1',
  kind: 'prayer',
  subject: 'S',
  message: 'M',
  classification: 'private',
  contactMethod: 'phone',
  phone: '1',
  email: 'e',
  availability: 'mon',
  createdAt: '2026-01-01T00:00:00.000Z',
}
const privateGrant = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}

const privateReader = () => vi.mocked(requiredScope).mockResolvedValue(privateGrant as never)
const standardReader = () =>
  vi.mocked(requiredScope).mockImplementation(() => {
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'NOT_ALLOWED',
      details: 'No.',
    })
  })

beforeEach(() => vi.clearAllMocks())

describe('resolveRequestReadScope', () => {
  it('returns churchIds for an authorized church', async () => {
    vi.mocked(requiredScope).mockResolvedValue(privateGrant as never)
    await expect(resolveRequestReadScope({ userId: 'u1', churchId: 'c1' })).resolves.toEqual({
      churchIds: new Set(['c1']),
    })
  })

  it('maps a 403 (out-of-scope church) to 404 so existence stays hidden', async () => {
    standardReader()
    await expect(resolveRequestReadScope({ userId: 'u1', churchId: 'c9' })).rejects.toMatchObject({
      code: 404,
    })
  })
})

describe('listRequests', () => {
  it('a private reader sees private + standard rows (canReadPrivate=true)', async () => {
    privateReader()
    vi.mocked(GET_REQUESTS).mockResolvedValue({
      result: [privateRow, { ...privateRow, id: 'r2' }],
      total: 2,
    } as never)
    const res = await listRequests({
      userId: 'u1',
      churchId: 'c1',
      churchIds: new Set(['c1']),
      query,
    })
    expect(res.total).toBe(2)
    expect(GET_REQUESTS).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', canReadPrivate: true, kinds: undefined }),
    )
  })

  it('a standard reader sees standard rows only (canReadPrivate=false)', async () => {
    standardReader()
    vi.mocked(GET_REQUESTS).mockResolvedValue({ result: [privateRow], total: 1 } as never)
    const res = await listRequests({
      userId: 'u1',
      churchId: 'c1',
      churchIds: new Set(['c1']),
      query,
    })
    // Controller passes the private flag off to the provider, which filters
    // BEFORE count/pagination — so a standard reader can never reveal totals.
    expect(GET_REQUESTS).toHaveBeenCalledWith(expect.objectContaining({ canReadPrivate: false }))
    expect(res.result).toHaveLength(1)
  })

  it('passes the kind allowlist through', async () => {
    standardReader()
    vi.mocked(GET_REQUESTS).mockResolvedValue({ result: [], total: 0 } as never)
    await listRequests({
      userId: 'u1',
      churchId: 'c1',
      churchIds: new Set(['c1']),
      kinds: ['pastoral', 'meeting'],
      query,
    })
    expect(GET_REQUESTS).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['pastoral', 'meeting'] }),
    )
  })

  it('throws 404 for a cross-church churchId (never reveals existence)', async () => {
    privateReader()
    await expect(
      listRequests({ userId: 'u1', churchId: 'c9', churchIds: new Set(['c1']), query }),
    ).rejects.toMatchObject({ code: 404 })
    expect(GET_REQUESTS).not.toHaveBeenCalled()
  })
})

describe('getRequestDetail', () => {
  it('a private reader sees a private row', async () => {
    privateReader()
    vi.mocked(GET_REQUEST).mockResolvedValue(privateRow as never)
    await expect(
      getRequestDetail({
        userId: 'u1',
        churchId: 'c1',
        churchIds: new Set(['c1']),
        requestId: 'r1',
        traceId: 't1',
      }),
    ).resolves.toEqual(privateRow)
    expect(GET_REQUEST).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'c1',
        canReadPrivate: true,
        requestId: 'r1',
        actorId: 'u1',
      }),
    )
  })

  it('a standard reader gets 404 when the row is private to them', async () => {
    standardReader()
    vi.mocked(GET_REQUEST).mockResolvedValue(null)
    await expect(
      getRequestDetail({
        userId: 'u1',
        churchId: 'c1',
        churchIds: new Set(['c1']),
        requestId: 'r1',
        traceId: 't1',
      }),
    ).rejects.toMatchObject({ code: 404 })
  })

  it('throws 404 for an out-of-scope requestId', async () => {
    privateReader()
    vi.mocked(GET_REQUEST).mockResolvedValue(null)
    await expect(
      getRequestDetail({
        userId: 'u1',
        churchId: 'c1',
        churchIds: new Set(['c1']),
        requestId: 'r-other',
        traceId: 't1',
      }),
    ).rejects.toMatchObject({ code: 404 })
  })

  it('throws 404 when the church is outside the caller scope', async () => {
    privateReader()
    await expect(
      getRequestDetail({
        userId: 'u1',
        churchId: 'c9',
        churchIds: new Set(['c1']),
        requestId: 'r1',
        traceId: 't1',
      }),
    ).rejects.toMatchObject({ code: 404 })
    expect(GET_REQUEST).not.toHaveBeenCalled()
  })
})
