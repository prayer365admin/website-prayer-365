// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/announcement', () => ({ getAnnouncementInScope: vi.fn() }))

import { GeneralError } from '@/utils/general-error'
import { getAnnouncementInScope } from '@/controller/announcement'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GET } from './route'

const churchIds = new Set(['c1'])
const call = (id: string) =>
  GET(new NextRequest(`http://localhost/api/v1/admin/central/announcements/${id}`), {
    params: Promise.resolve({ announcementId: id }),
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds } as never)
})

describe('GET /admin/central/announcements/:announcementId', () => {
  it('returns the announcement resolved within the central scope', async () => {
    vi.mocked(getAnnouncementInScope).mockResolvedValue({ id: 'a1', churchId: 'c1' } as never)

    const response = await call('a1')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ result: { id: 'a1', churchId: 'c1' } })
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_announcement',
      action: 'read',
    })
    expect(getAnnouncementInScope).toHaveBeenCalledWith({ churchIds, announcementId: 'a1' })
  })

  it('returns 404 when the announcement is missing or out of scope', async () => {
    vi.mocked(getAnnouncementInScope).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Announcement not found.',
      }),
    )

    expect((await call('nope')).status).toBe(404)
  })
})
