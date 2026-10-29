// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/central-church', () => ({
  getChurch: vi.fn(),
  purgeChurch: vi.fn(),
  updateChurch: vi.fn(),
}))

import { getChurch, purgeChurch } from '@/controller/central-church'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { DELETE, GET } from './route'

const auth = { session: { user: { user_id: 'actor' } } }
const params = { params: Promise.resolve({ churchId: 'ch1' }) }

const del = (body: unknown = { version: 1, confirmName: 'Church' }) =>
  new NextRequest('http://localhost/api/v1/admin/central/churches/ch1', {
    method: 'DELETE',
    body: JSON.stringify(body),
  })

describe('DELETE /api/v1/admin/central/churches/[churchId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('requires the delete action on prayer_church before touching the controller', async () => {
    vi.mocked(purgeChurch).mockResolvedValue(undefined as never)

    const res = (await DELETE(del(), params))!

    expect(res.status).toBe(204)
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({
        central: true,
        subject: 'prayer_church',
        action: 'delete',
      }),
    )
    expect(purgeChurch).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'ch1',
        actorId: 'actor',
        payload: { version: 1, confirmName: 'Church' },
      }),
    )
  })

  it('403 when the delete scope is denied', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'denied',
      }),
    )

    const res = (await DELETE(del(), params))!

    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('NOT_ALLOWED')
    expect(purgeChurch).not.toHaveBeenCalled()
  })

  it('422 for a missing confirmation name', async () => {
    const res = (await DELETE(del({ version: 1 }), params))!

    expect(res.status).toBe(422)
    expect(purgeChurch).not.toHaveBeenCalled()
  })

  it('surfaces the controller 409 (church has content / wrong state)', async () => {
    vi.mocked(purgeChurch).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'CHURCH_HAS_CONTENT',
        details: 'This church still has related records, so it cannot be deleted.',
        fields: { prayers: '2' },
      }),
    )

    const res = (await DELETE(del(), params))!
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error_code).toBe('CHURCH_HAS_CONTENT')
    expect(body.fields).toEqual({ prayers: '2' })
  })
})

describe('GET /api/v1/admin/central/churches/[churchId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('returns the setup detail for the S16 screen', async () => {
    vi.mocked(getChurch).mockResolvedValue({ id: 'ch1', name: 'Church' } as never)

    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/central/churches/ch1'),
      params,
    ))!

    expect(res.status).toBe(200)
    expect((await res.json()).result).toMatchObject({ id: 'ch1', name: 'Church' })
  })
})
