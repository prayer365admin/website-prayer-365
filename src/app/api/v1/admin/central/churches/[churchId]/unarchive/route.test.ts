// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/central-church', () => ({
  unarchiveChurch: vi.fn(),
}))

import { unarchiveChurch } from '@/controller/central-church'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { POST } from './route'

const auth = { session: { user: { user_id: 'actor' } } }
const params = { params: Promise.resolve({ churchId: 'ch1' }) }

const post = (body: unknown = { version: 1 }) =>
  new NextRequest('http://localhost/api/v1/admin/central/churches/ch1/unarchive', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('POST /api/v1/admin/central/churches/[churchId]/unarchive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('unarchives church successfully', async () => {
    vi.mocked(unarchiveChurch).mockResolvedValue({ id: 'ch1', status: 'APPROVED' } as never)

    const res = await POST(post(), params)
    expect(res.status).toBe(200)
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({
        central: true,
        subject: 'prayer_church_lifecycle',
        action: 'update',
      }),
    )
    expect(unarchiveChurch).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'ch1',
        version: 1,
        actorId: 'actor',
      }),
    )
  })
})
