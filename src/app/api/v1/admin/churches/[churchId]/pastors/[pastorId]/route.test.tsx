// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/pastor', () => ({ patchChurchPastor: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { patchChurchPastor } from '@/controller/pastor'
import { GeneralError } from '@/utils/general-error'
import { PATCH } from './route'

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const params = { params: Promise.resolve({ churchId: 'c1', pastorId: 'p1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}

describe('PATCH /api/v1/admin/churches/[churchId]/pastors/[pastorId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates church-scoped fields (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchChurchPastor).mockResolvedValue({
      id: 'p1',
      name: 'A',
      introduction: null,
      pastoralRole: 'Associate',
      imageAssetId: null,
    } as never)
    const req = new NextRequest('http://x/pastors/p1', {
      method: 'PATCH',
      body: JSON.stringify({ version: 3, pastoral_role: 'Associate' }),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result.pastoralRole).toBe('Associate')
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'prayer_pastor', action: 'update' }),
    )
    expect(patchChurchPastor).toHaveBeenCalledWith(
      expect.objectContaining({
        pastorId: 'p1',
        input: expect.objectContaining({ pastoral_role: 'Associate' }),
      }),
    )
  })

  it('rejects shared pastor identity fields with 422', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const req = new NextRequest('http://x/pastors/p1', {
      method: 'PATCH',
      body: JSON.stringify({ version: 3, name: 'Hack' }),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(422)
  })

  it('returns 404 when pastor not found', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchChurchPastor).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'nope',
      }),
    )
    const req = new NextRequest('http://x/pastors/p1', {
      method: 'PATCH',
      body: JSON.stringify({ version: 3, pastoral_role: 'Associate' }),
    })
    const res = (await PATCH(req, params as never))!
    expect(res.status).toBe(404)
  })
})
