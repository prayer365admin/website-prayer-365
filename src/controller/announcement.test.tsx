import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/announcement', () => ({
  CREATE_ANNOUNCEMENT: vi.fn(),
  GET_ANNOUNCEMENT: vi.fn(),
  LIST_ANNOUNCEMENTS: vi.fn(),
  PUBLISH_ANNOUNCEMENT: vi.fn(),
  UPDATE_ANNOUNCEMENT: vi.fn(),
}))

import {
  CREATE_ANNOUNCEMENT,
  GET_ANNOUNCEMENT,
  LIST_ANNOUNCEMENTS,
  PUBLISH_ANNOUNCEMENT,
  UPDATE_ANNOUNCEMENT,
} from '@/providers/announcement'
import {
  createAnnouncement,
  listAnnouncements,
  patchAnnouncement,
  publishAnnouncement,
} from './announcement'

const scope = new Set(['c1'])
const input = { title: 'News', body: 'body text' }
const annOut = {
  id: 'a1',
  churchId: 'c1',
  title: 'News',
  body: 'body text',
  publishedAt: null,
  version: 3,
}

beforeEach(() => vi.clearAllMocks())

describe('listAnnouncements', () => {
  it('delegates to LIST_ANNOUNCEMENTS', async () => {
    vi.mocked(LIST_ANNOUNCEMENTS).mockResolvedValue({ result: [], total: 0 } as never)
    await expect(listAnnouncements({ churchIds: scope, query: {} as never })).resolves.toEqual({
      result: [],
      total: 0,
    })
  })
})

describe('createAnnouncement', () => {
  it('creates an unpublished announcement', async () => {
    vi.mocked(CREATE_ANNOUNCEMENT).mockResolvedValue(annOut as never)
    const res = await createAnnouncement({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      input,
      requestId: 'r',
    })
    expect(CREATE_ANNOUNCEMENT).toHaveBeenCalledWith(expect.objectContaining({ churchId: 'c1' }))
    expect(res.publishedAt).toBeNull()
  })

  it('throws 403 for a cross-church caller', async () => {
    await expect(
      createAnnouncement({ userId: 'u1', churchId: 'c9', churchIds: scope, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403 })
  })
})

describe('patchAnnouncement', () => {
  it('updates title/body with matching version', async () => {
    vi.mocked(GET_ANNOUNCEMENT).mockResolvedValue({ ...annOut, version: 3 } as never)
    vi.mocked(UPDATE_ANNOUNCEMENT).mockResolvedValue({ ...annOut, version: 4 } as never)
    const res = await patchAnnouncement({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      announcementId: 'a1',
      input: { ...input, version: 3 },
      requestId: 'r',
    })
    expect(UPDATE_ANNOUNCEMENT).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3 }),
    )
    expect(res.version).toBe(4)
  })

  it('throws 409 on stale version (PATCH)', async () => {
    vi.mocked(GET_ANNOUNCEMENT).mockResolvedValue({ ...annOut, version: 9 } as never)
    await expect(
      patchAnnouncement({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        announcementId: 'a1',
        input: { ...input, version: 3 },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })
})

describe('publishAnnouncement', () => {
  it('publishes immediately (published_at set) with matching version', async () => {
    vi.mocked(GET_ANNOUNCEMENT).mockResolvedValue({ ...annOut, version: 3 } as never)
    vi.mocked(PUBLISH_ANNOUNCEMENT).mockResolvedValue({
      ...annOut,
      publishedAt: '2026-10-01T00:00:00.000Z',
      version: 4,
    } as never)
    const res = await publishAnnouncement({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      announcementId: 'a1',
      input: { version: 3 },
      requestId: 'r',
    })
    expect(PUBLISH_ANNOUNCEMENT).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3 }),
    )
    expect(res.publishedAt).toBeTruthy()
  })

  it('throws 409 on stale version (publish)', async () => {
    vi.mocked(GET_ANNOUNCEMENT).mockResolvedValue({ ...annOut, version: 9 } as never)
    await expect(
      publishAnnouncement({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        announcementId: 'a1',
        input: { version: 3 },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })
})
