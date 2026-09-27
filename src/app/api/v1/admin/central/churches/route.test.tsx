// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/central-church', () => ({
  createChurch: vi.fn(),
  listChurches: vi.fn(),
}))

import { GeneralError } from '@/utils/general-error'
import { createChurch, listChurches } from '@/controller/central-church'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GET, POST } from './route'

const auth = { session: { user: { user_id: 'actor' } } }

describe('GET /api/v1/admin/central/churches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('returns 200 with the church list envelope', async () => {
    vi.mocked(listChurches).mockResolvedValue({ total: 1, result: [{ id: 'ch1' }] } as never)
    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/central/churches')))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, total: 1 })
    expect(body.request_id).toBeTruthy()
  })

  it('enforces permission — 403 when the central church scope is denied', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'denied',
      }),
    )
    const res = (await GET(new NextRequest('http://localhost/api/v1/admin/central/churches')))!
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('NOT_ALLOWED')
  })
})

describe('POST /api/v1/admin/central/churches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('creates a pending church and returns 201', async () => {
    vi.mocked(createChurch).mockResolvedValue({ id: 'ch1', status: 'PENDING' } as never)
    const req = new NextRequest('http://localhost/api/v1/admin/central/churches', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Church', timezone: 'Europe/Tallinn', parentId: 'd1' }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ success: true, message: 'Church created' })
  })

  it('returns 422 for a missing timezone (invalid body)', async () => {
    const req = new NextRequest('http://localhost/api/v1/admin/central/churches', {
      method: 'POST',
      body: JSON.stringify({ name: 'No TZ' }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(422)
  })
})
