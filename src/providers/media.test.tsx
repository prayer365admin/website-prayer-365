import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/db-connection', () => ({
  db: {
    mediaAsset: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '@/utils/db-connection'
import {
  GET_ASSET,
  GET_ASSET_BY_ID_AND_CHURCH,
  LIST_UNATTACHED_PENDING_OLDER_THAN,
  MARK_READY,
  CREATE_PENDING_ASSET,
  DELETE_ASSET,
} from './media'

beforeEach(() => vi.clearAllMocks())

describe('GET_ASSET / GET_ASSET_BY_ID_AND_CHURCH', () => {
  it('returns null for an empty scope (no cross-tenant leak)', async () => {
    await expect(GET_ASSET({ churchIds: new Set(), assetId: 'a1' })).resolves.toBeNull()
    expect(db.mediaAsset.findFirst).not.toHaveBeenCalled()
  })

  it('scopes the lookup to the caller church ids', async () => {
    vi.mocked(db.mediaAsset.findFirst).mockResolvedValue({ id: 'a1' } as never)
    await GET_ASSET({ churchIds: new Set(['c1', 'c2']), assetId: 'a1' })
    expect(db.mediaAsset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1', church_id: { in: ['c1', 'c2'] } },
      }),
    )
  })

  it('looks up by URL church for the controller', async () => {
    vi.mocked(db.mediaAsset.findFirst).mockResolvedValue({ id: 'a1' } as never)
    await GET_ASSET_BY_ID_AND_CHURCH({ assetId: 'a1', churchId: 'c1' })
    expect(db.mediaAsset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1', church_id: 'c1' } }),
    )
  })
})

describe('CREATE_PENDING_ASSET', () => {
  it('maps camelCase to snake_case with PENDING + uploaded_by', async () => {
    vi.mocked(db.mediaAsset.create).mockResolvedValue({ id: 'a1' } as never)
    await CREATE_PENDING_ASSET({
      churchId: 'c1',
      purpose: 'VOICE_SAMPLE',
      mimeType: 'audio/mpeg',
      byteSize: 1234,
      objectKey: 'media/c1/voice_sample/x',
      uploadedBy: 'u1',
    })
    const data = vi.mocked(db.mediaAsset.create).mock.calls[0][0]!.data
    expect(data).toMatchObject({
      church_id: 'c1',
      purpose: 'VOICE_SAMPLE',
      mime_type: 'audio/mpeg',
      byte_size: BigInt(1234),
      object_key: 'media/c1/voice_sample/x',
      status: 'PENDING',
      uploaded_by: 'u1',
    })
  })
})

describe('MARK_READY', () => {
  it('only flips PENDING assets within scope and stores the checksum', async () => {
    vi.mocked(db.mediaAsset.updateMany).mockResolvedValue({ count: 1 } as never)
    await MARK_READY({ churchIds: new Set(['c1']), assetId: 'a1', checksum: 'c'.repeat(64) })
    const args = vi.mocked(db.mediaAsset.updateMany).mock.calls[0][0]!
    expect(args.where).toMatchObject({
      id: 'a1',
      church_id: { in: ['c1'] },
      status: 'PENDING',
    })
    expect(args.data).toMatchObject({ status: 'READY', checksum: 'c'.repeat(64) })
  })
})

describe('LIST_UNATTACHED_PENDING_OLDER_THAN', () => {
  it('filters pending + older-than + no references', async () => {
    vi.mocked(db.mediaAsset.findMany).mockResolvedValue([{ id: 'a1', object_key: 'k' }] as never)
    const when = new Date('2026-01-01T00:00:00Z')
    await LIST_UNATTACHED_PENDING_OLDER_THAN({ olderThan: when })
    const args = vi.mocked(db.mediaAsset.findMany).mock.calls[0][0] as unknown as {
      where: Record<string, unknown>
      select: Record<string, boolean>
    }
    expect(args.where.status).toBe('PENDING')
    expect(args.where.created_at).toEqual({ lt: when })
    expect(args.where.coverOf).toEqual({ none: {} })
    expect(args.where.voiceSamples).toEqual({ none: {} })
    expect(args.where.audioAssets).toEqual({ none: {} })
    expect(args.select).toMatchObject({ id: true, object_key: true })
  })
})

describe('DELETE_ASSET', () => {
  it('deletes by id', async () => {
    vi.mocked(db.mediaAsset.delete).mockResolvedValue({} as never)
    await DELETE_ASSET({ assetId: 'a1' })
    expect(db.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
  })
})
