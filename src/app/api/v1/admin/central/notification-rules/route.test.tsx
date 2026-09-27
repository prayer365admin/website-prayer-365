// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/notification', () => ({
  listNotificationRules: vi.fn(),
  updateNotificationRules: vi.fn(),
}))

import { GeneralError } from '@/utils/general-error'
import { listNotificationRules, updateNotificationRules } from '@/controller/notification'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GET, PUT } from './route'

const auth = { session: { user: { user_id: 'actor' } } }
const URL = 'http://localhost/api/v1/admin/central/notification-rules'

describe('GET /api/v1/admin/central/notification-rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('returns 200 with the rules array envelope and request_id', async () => {
    vi.mocked(listNotificationRules).mockResolvedValue([
      { type: 'donation_reminder', enabled: true },
    ] as never)
    const res = (await GET(new NextRequest(URL)))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true })
    expect(body.result).toHaveLength(1)
    expect(body.request_id).toBeTruthy()
  })

  it('returns 403 when the read permission is denied', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'denied',
      }),
    )
    const res = (await GET(new NextRequest(URL)))!
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('NOT_ALLOWED')
  })
})

describe('PUT /api/v1/admin/central/notification-rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('returns 200 after a successful batch update', async () => {
    vi.mocked(updateNotificationRules).mockResolvedValue([
      { type: 'donation_reminder', enabled: true, version: 2 },
    ] as never)
    const req = new NextRequest(URL, {
      method: 'PUT',
      body: JSON.stringify([{ type: 'donation_reminder', version: 1, enabled: true }]),
    })
    const res = (await PUT(req))!
    expect(res.status).toBe(200)
    expect((await res.json()).result).toHaveLength(1)
  })

  it('returns 422 for a disallowed rule type', async () => {
    const req = new NextRequest(URL, {
      method: 'PUT',
      body: JSON.stringify([{ type: 'marketing_push', version: 1, enabled: true }]),
    })
    const res = (await PUT(req))!
    expect(res.status).toBe(422)
    expect(updateNotificationRules).not.toHaveBeenCalled()
  })

  it('returns 422 for an offset outside the allowlist', async () => {
    const req = new NextRequest(URL, {
      method: 'PUT',
      body: JSON.stringify([{ type: 'donation_reminder', version: 1, offset_minutes: 45 }]),
    })
    const res = (await PUT(req))!
    expect(res.status).toBe(422)
    expect(updateNotificationRules).not.toHaveBeenCalled()
  })

  it('returns 403 when the update permission is denied', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'denied',
      }),
    )
    const req = new NextRequest(URL, {
      method: 'PUT',
      body: JSON.stringify([{ type: 'donation_reminder', version: 1, enabled: true }]),
    })
    const res = (await PUT(req))!
    expect(res.status).toBe(403)
  })
})
