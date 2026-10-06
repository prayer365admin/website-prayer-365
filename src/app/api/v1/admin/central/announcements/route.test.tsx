// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/announcement', () => ({ listAnnouncements: vi.fn() }))

import { GeneralError } from '@/utils/general-error'
import { listAnnouncements } from '@/controller/announcement'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GET } from './route'

const churchIds = new Set(['c1', 'c2'])

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds } as never)
})

describe('GET /admin/central/announcements', () => {
  it('lists announcements across the central scope', async () => {
    vi.mocked(listAnnouncements).mockResolvedValue({
      total: 1,
      result: [{ id: 'a1', church: { name: 'Grace', timezone: 'UTC' } }],
    } as never)

    const response = await GET(
      new NextRequest(
        'http://localhost/api/v1/admin/central/announcements?page=1&limit=10&status=draft',
      ),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, total: 1, page: 1, limit: 10 })
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_announcement',
      action: 'read',
    })
    expect(listAnnouncements).toHaveBeenCalledWith({
      churchIds,
      query: expect.objectContaining({ page: 1, limit: 10, status: 'draft' }),
    })
  })

  it('rejects callers without a central grant', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'This account is not allowed for this action.',
      }),
    )

    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/announcements'),
    )

    expect(response.status).toBe(403)
    expect(listAnnouncements).not.toHaveBeenCalled()
  })
})
