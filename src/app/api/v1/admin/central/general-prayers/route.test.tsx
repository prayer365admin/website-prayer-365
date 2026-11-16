// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/general-prayer', () => ({
  listGeneralPrayers: vi.fn(),
  createGeneralPrayer: vi.fn(),
  getGeneralPrayer: vi.fn(),
  updateGeneralPrayer: vi.fn(),
  enqueueGeneralPrayerAudio: vi.fn(),
}))

import { createGeneralPrayer, listGeneralPrayers } from '@/controller/general-prayer'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { GET, POST } from './route'

const UNAUTH = new GeneralError({
  code: 401,
  error: 'Not Authenticated!',
  error_code: 'UNAUTHORIZED',
  details: 'Please login and try again!',
})
const NO_SCOPE = new GeneralError({
  code: 403,
  error: 'UNAUTHORIZED',
  error_code: 'NOT_ALLOWED',
  details: 'This account is not allowed for this action.',
})

const created = { id: 'gp-1', slug: 'paivapalve-1', sequence: 1, version: 1 } as never
const validBody = {
  sequence: 11,
  title: 'Uus päevapalve',
  body: '<p>Aamen.</p>',
  languageCode: 'et',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds: new Set() } as never)
})

describe('GET /admin/central/general-prayers', () => {
  it('requires authentication (401)', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)
    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers'),
    )
    expect(response.status).toBe(401)
    expect(listGeneralPrayers).not.toHaveBeenCalled()
  })

  it('requires the prayer_general_prayer read scope (403)', async () => {
    vi.mocked(requiredScope).mockRejectedValue(NO_SCOPE)
    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers'),
    )
    expect(response.status).toBe(403)
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_general_prayer',
      action: 'read',
    })
    expect(listGeneralPrayers).not.toHaveBeenCalled()
  })

  it('marks the authenticated list uncacheable', async () => {
    vi.mocked(listGeneralPrayers).mockResolvedValue({ result: [], total: 0 })
    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers'),
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('returns the paginated list envelope', async () => {
    vi.mocked(listGeneralPrayers).mockResolvedValue({ result: [], total: 0 })
    const response = await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/central/general-prayers?page=2&limit=5&isActive=true&search=palve',
      ),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, total: 0, page: 2, limit: 5 })
    expect(listGeneralPrayers).toHaveBeenCalledWith({
      query: expect.objectContaining({ page: 2, limit: 5, isActive: true, search: 'palve' }),
    })
  })
})

describe('POST /admin/central/general-prayers', () => {
  it('requires the create scope (403)', async () => {
    vi.mocked(requiredScope).mockRejectedValue(NO_SCOPE)
    const response = await POST(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers', {
        method: 'POST',
        body: JSON.stringify(validBody),
      }),
    )
    expect(response.status).toBe(403)
    expect(createGeneralPrayer).not.toHaveBeenCalled()
  })

  it('creates with the caller as the actor and answers 201', async () => {
    vi.mocked(createGeneralPrayer).mockResolvedValue(created)
    const response = await POST(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers', {
        method: 'POST',
        body: JSON.stringify(validBody),
      }),
    )
    expect(response.status).toBe(201)
    expect(createGeneralPrayer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin',
        input: expect.objectContaining({ sequence: 11 }),
      }),
    )
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_general_prayer',
      action: 'create',
    })
  })

  it('rejects a body without a cycle position (422)', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers', {
        method: 'POST',
        body: JSON.stringify({ title: 'x', body: '<p>y</p>' }),
      }),
    )
    expect(response.status).toBe(422)
    expect(createGeneralPrayer).not.toHaveBeenCalled()
  })

  it('hands a script-only body to the controller, which owns sanitisation', async () => {
    // The schema checks for *text* after tag stripping; the controller decides
    // whether anything survives sanitisation (covered by its own unit test).
    vi.mocked(createGeneralPrayer).mockResolvedValue(created)
    await POST(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, body: '<script>alert(1)</script>' }),
      }),
    )
    expect(createGeneralPrayer).toHaveBeenCalledTimes(1)
  })

  it('relays a taken cycle position as 409', async () => {
    vi.mocked(createGeneralPrayer).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'SEQUENCE_TAKEN',
        details: 'Another general prayer already holds that cycle position.',
      }),
    )
    const response = await POST(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers', {
        method: 'POST',
        body: JSON.stringify(validBody),
      }),
    )
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error_code: 'SEQUENCE_TAKEN' })
  })
})
