import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/media', () => ({
  LIST_UNATTACHED_PENDING_OLDER_THAN: vi.fn(),
  DELETE_ASSET: vi.fn(),
}))
vi.mock('@/providers/s3', () => ({ S3_DELETE_OBJECT: vi.fn() }))

import { LIST_UNATTACHED_PENDING_OLDER_THAN, DELETE_ASSET } from '@/providers/media'
import { S3_DELETE_OBJECT } from '@/providers/s3'
import { runMediaCleanup } from './media-cleanup'

beforeEach(() => vi.clearAllMocks())

describe('runMediaCleanup', () => {
  it('deletes old unattached PENDING objects and rows and returns the count', async () => {
    vi.mocked(LIST_UNATTACHED_PENDING_OLDER_THAN).mockResolvedValue([
      { id: 'a1', object_key: 'media/c1/image/old1' },
      { id: 'a2', object_key: 'media/c1/voice_sample/old2' },
    ] as never)
    const count = await runMediaCleanup({ ttlDays: 14, now: new Date('2026-09-01T00:00:00Z') })
    expect(count).toBe(2)
    expect(S3_DELETE_OBJECT).toHaveBeenNthCalledWith(1, { key: 'media/c1/image/old1' })
    expect(S3_DELETE_OBJECT).toHaveBeenNthCalledWith(2, { key: 'media/c1/voice_sample/old2' })
    expect(DELETE_ASSET).toHaveBeenNthCalledWith(1, { assetId: 'a1' })
    expect(DELETE_ASSET).toHaveBeenNthCalledWith(2, { assetId: 'a2' })
    // S3 object removed before the DB row.
    expect(vi.mocked(DELETE_ASSET).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(S3_DELETE_OBJECT).mock.invocationCallOrder[0],
    )
  })

  it('computes the cutoff as TTL before now', async () => {
    vi.mocked(LIST_UNATTACHED_PENDING_OLDER_THAN).mockResolvedValue([] as never)
    await runMediaCleanup({ ttlDays: 7, now: new Date('2026-09-08T12:00:00Z') })
    const cutoff = vi.mocked(LIST_UNATTACHED_PENDING_OLDER_THAN).mock.calls[0][0]!.olderThan
    expect(cutoff.toISOString()).toBe('2026-09-01T12:00:00.000Z')
  })

  it('does nothing when there are no stale assets', async () => {
    vi.mocked(LIST_UNATTACHED_PENDING_OLDER_THAN).mockResolvedValue([] as never)
    const count = await runMediaCleanup({ ttlDays: 14 })
    expect(count).toBe(0)
    expect(S3_DELETE_OBJECT).not.toHaveBeenCalled()
    expect(DELETE_ASSET).not.toHaveBeenCalled()
  })
})
