// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/pastor', () => ({
  createPastor: vi.fn(),
  getPastor: vi.fn(),
  listPastors: vi.fn(),
  putChurchPastors: vi.fn(),
  updatePastor: vi.fn(),
}))

import { GeneralError } from '@/utils/general-error'
import {
  createPastor,
  getPastor,
  listPastors,
  putChurchPastors,
  updatePastor,
} from '@/controller/pastor'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { PUT as PutAssignments } from '../churches/[churchId]/pastors/route'
import { GET as GetPastor, PATCH } from './[pastorId]/route'
import { GET, POST } from './route'

const auth = { session: { user: { user_id: 'admin' } } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue(auth as never)
  vi.mocked(requiredScope).mockResolvedValue({} as never)
})

describe('central pastor routes', () => {
  it('lists pastor profiles with the standard list envelope', async () => {
    vi.mocked(listPastors).mockResolvedValue({
      total: 1,
      result: [{ id: 'p1', name: 'Pastor A' }],
    } as never)

    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/pastors?page=1&limit=10'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, total: 1, page: 1, limit: 10 })
  })

  it('creates a profile without a linked staff account', async () => {
    vi.mocked(createPastor).mockResolvedValue({ id: 'p1', user_id: null } as never)
    const response = await POST(
      new NextRequest('http://localhost/api/v1/admin/central/pastors', {
        method: 'POST',
        body: JSON.stringify({ name: 'Pastor A', introduction: 'Biography' }),
      }),
    )

    expect(response.status).toBe(201)
    expect(createPastor).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ name: 'Pastor A' }) }),
    )
  })

  it('updates the central-owned profile fields', async () => {
    vi.mocked(updatePastor).mockResolvedValue({ id: 'p1', name: 'Pastor Updated' } as never)
    const response = await PATCH(
      new NextRequest('http://localhost/api/v1/admin/central/pastors/p1', {
        method: 'PATCH',
        body: JSON.stringify({ version: 2, name: 'Pastor Updated' }),
      }),
      { params: Promise.resolve({ pastorId: 'p1' }) },
    )

    expect(response.status).toBe(200)
    expect(updatePastor).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { version: 2, name: 'Pastor Updated' } }),
    )
  })

  it('rejects a central profile update without its expected version', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/v1/admin/central/pastors/p1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Pastor Updated' }),
      }),
      { params: Promise.resolve({ pastorId: 'p1' }) },
    )

    expect(response.status).toBe(422)
    expect(updatePastor).not.toHaveBeenCalled()
  })

  it('gets one profile for the dedicated edit page', async () => {
    vi.mocked(getPastor).mockResolvedValue({
      id: 'p1',
      name: 'Pastor A',
      user_id: null,
    } as never)
    const response = await GetPastor(
      new NextRequest('http://localhost/api/v1/admin/central/pastors/p1'),
      { params: Promise.resolve({ pastorId: 'p1' }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      result: { id: 'p1', name: 'Pastor A' },
    })
  })

  it('denies assignment replacement when central pastor scope is missing', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'Denied',
      }),
    )
    const response = await PutAssignments(
      new NextRequest('http://localhost/api/v1/admin/central/churches/c1/pastors', {
        method: 'PUT',
        body: JSON.stringify({
          assigned: [{ pastorId: 'p1', pastoralRole: 'Lead pastor' }],
        }),
      }),
      { params: Promise.resolve({ churchId: 'c1' }) },
    )

    expect(response.status).toBe(403)
    expect(putChurchPastors).not.toHaveBeenCalled()
  })
})
