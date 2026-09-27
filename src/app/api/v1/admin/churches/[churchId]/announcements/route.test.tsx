// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import {
  createAnnouncement,
  listAnnouncements,
  patchAnnouncement,
  publishAnnouncement,
} from '@/controller/announcement'
import { GeneralError } from '@/utils/general-error'
import { GET, POST } from './route'
import { PATCH } from './[announcementId]/route'
import { POST as PUBLISH } from './[announcementId]/publish/route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/announcement', () => ({
  createAnnouncement: vi.fn(),
  listAnnouncements: vi.fn(),
  patchAnnouncement: vi.fn(),
  publishAnnouncement: vi.fn(),
}))

const auth = () => ({ session: { user: { user_id: 'u1' } } })
const churchParams = { params: Promise.resolve({ churchId: 'c1' }) }
const annParams = { params: Promise.resolve({ churchId: 'c1', announcementId: 'a1' }) }
const scope = {
  userId: 'u1',
  churchIds: new Set(['c1']),
  scope: { kind: 'church', orgNodeId: 'n1', name: '' },
}
const input = { title: 'News', body: 'body' }

describe('announcements', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists announcements (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(listAnnouncements).mockResolvedValue({ result: [], total: 0 } as never)
    const res = (await GET(new NextRequest('http://x/announcements'), churchParams as never))!
    expect(res.status).toBe(200)
  })

  it('creates an announcement (201)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(createAnnouncement).mockResolvedValue({ id: 'a1' } as never)
    const req = new NextRequest('http://x/announcements', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const res = (await POST(req, churchParams as never))!
    expect(res.status).toBe(201)
  })

  it('patches an announcement (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(patchAnnouncement).mockResolvedValue({ id: 'a1', version: 4 } as never)
    const req = new NextRequest('http://x/announcements/a1', {
      method: 'PATCH',
      body: JSON.stringify({ ...input, version: 3 }),
    })
    const res = (await PATCH(req, annParams as never))!
    expect(res.status).toBe(200)
  })

  it('publishes immediately (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(publishAnnouncement).mockResolvedValue({
      id: 'a1',
      publishedAt: '2026-10-01T00:00:00.000Z',
      version: 4,
    } as never)
    const req = new NextRequest('http://x/announcements/a1/publish', {
      method: 'POST',
      body: JSON.stringify({ version: 3 }),
    })
    const res = (await PUBLISH(req, annParams as never))!
    expect(res.status).toBe(200)
    expect((await res.json()).result.publishedAt).toBeTruthy()
  })

  it('returns 409 on stale publish', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(publishAnnouncement).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'stale',
      }),
    )
    const req = new NextRequest('http://x/announcements/a1/publish', {
      method: 'POST',
      body: JSON.stringify({ version: 3 }),
    })
    const res = (await PUBLISH(req, annParams as never))!
    expect(res.status).toBe(409)
  })
})
