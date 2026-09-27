// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/pastor', () => ({ getChurchPastors: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { getChurchPastors } from '@/controller/pastor'
import { GeneralError } from '@/utils/general-error'
import { GET } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}

describe('GET /api/v1/admin/churches/[churchId]/pastors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns assigned pastors (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(getChurchPastors).mockResolvedValue([
      { id: 'p1', name: 'A', introduction: null, pastoralRole: 'Lead', imageAssetId: null },
    ] as never)
    const res = (await GET(new NextRequest('http://x/pastors'), params as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result).toHaveLength(1)
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'prayer_pastor', action: 'read' }),
    )
  })

  it('returns 403 when not allowed', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'No.',
      }),
    )
    const res = (await GET(new NextRequest('http://x/pastors'), params as never))!
    expect(res.status).toBe(403)
  })
})
