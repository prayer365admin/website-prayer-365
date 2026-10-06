// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  patchAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
} from '@/controller/announcement'
import { GeneralError } from '@/utils/general-error'
import { GET, POST } from './route'
import { DELETE, PATCH } from './[announcementId]/route'
import { POST as PUBLISH } from './[announcementId]/publish/route'
import { POST as UNPUBLISH } from './[announcementId]/unpublish/route'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/announcement', () => ({
  createAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  listAnnouncements: vi.fn(),
  patchAnnouncement: vi.fn(),
  publishAnnouncement: vi.fn(),
  unpublishAnnouncement: vi.fn(),
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

  it('passes validated status and publication-date filters to the controller', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(listAnnouncements).mockResolvedValue({ result: [], total: 0 } as never)
    const request = new NextRequest(
      'http://x/announcements?status=published&published_from=2026-10-01T00%3A00%3A00.000Z&published_to=2026-10-31T23%3A59%3A59.000Z',
    )

    const response = (await GET(request, churchParams as never))!

    expect(response.status).toBe(200)
    expect(listAnnouncements).toHaveBeenCalledWith({
      churchIds: scope.churchIds,
      query: expect.objectContaining({
        status: 'published',
        published_from: '2026-10-01T00:00:00.000Z',
        published_to: '2026-10-31T23:59:59.000Z',
      }),
    })
  })

  it('rejects invalid Announcement filters', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const response = (await GET(
      new NextRequest('http://x/announcements?status=scheduled'),
      churchParams as never,
    ))!

    expect(response.status).toBe(422)
    expect(requiredScope).not.toHaveBeenCalled()
    expect(listAnnouncements).not.toHaveBeenCalled()
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
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'c1',
        subject: 'prayer_announcement_publication',
        action: 'update',
      }),
    )
  })

  it('does not call publish when update permission is denied', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'Missing announcement update permission.',
      }),
    )
    const req = new NextRequest('http://x/announcements/a1/publish', {
      method: 'POST',
      body: JSON.stringify({ version: 3 }),
    })

    const res = (await PUBLISH(req, annParams as never))!

    expect(res.status).toBe(403)
    expect(publishAnnouncement).not.toHaveBeenCalled()
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

  it('unpublishes with update permission (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(unpublishAnnouncement).mockResolvedValue({
      id: 'a1',
      publishedAt: null,
      version: 5,
    } as never)
    const request = new NextRequest('http://x/announcements/a1/unpublish', {
      method: 'POST',
      body: JSON.stringify({ version: 4 }),
    })

    const response = (await UNPUBLISH(request, annParams as never))!

    expect(response.status).toBe(200)
    expect((await response.json()).result).toMatchObject({ publishedAt: null, version: 5 })
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'c1',
        subject: 'prayer_announcement_publication',
        action: 'update',
      }),
    )
  })

  it('soft-deletes with delete permission and the current version (200)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockResolvedValue(scope as never)
    vi.mocked(deleteAnnouncement).mockResolvedValue(undefined)
    const request = new NextRequest('http://x/announcements/a1', {
      method: 'DELETE',
      body: JSON.stringify({ version: 4 }),
    })

    const response = (await DELETE(request, annParams as never))!

    expect(response.status).toBe(200)
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', subject: 'prayer_announcement', action: 'delete' }),
    )
    expect(deleteAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', announcementId: 'a1', input: { version: 4 } }),
    )
  })

  it('rejects a delete without a version before touching scope or data (422)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    const request = new NextRequest('http://x/announcements/a1', { method: 'DELETE' })

    const response = (await DELETE(request, annParams as never))!

    expect(response.status).toBe(422)
    expect(deleteAnnouncement).not.toHaveBeenCalled()
  })

  it('does not delete when delete permission is denied (403)', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(auth() as never)
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'Missing announcement delete permission.',
      }),
    )
    const request = new NextRequest('http://x/announcements/a1', {
      method: 'DELETE',
      body: JSON.stringify({ version: 4 }),
    })

    const response = (await DELETE(request, annParams as never))!

    expect(response.status).toBe(403)
    expect(deleteAnnouncement).not.toHaveBeenCalled()
  })
})
