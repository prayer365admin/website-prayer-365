// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET_ASSIGNABLE_PASTOR_IMAGE, GET_CHURCH_PASTORS, UPDATE_PASTOR } from './pastor'

const { db } = vi.hoisted(() => {
  return {
    db: {
      churchPastor: { findMany: vi.fn() },
      mediaAsset: { findFirst: vi.fn() },
    },
  }
})

vi.mock('@/utils/db-connection', () => ({ db }))

const tx = {
  pastor: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
}

describe('Pastor Provider', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('GET_CHURCH_PASTORS', () => {
    it('maps voiceReady: true and activeVoiceProfileId when fully ready', async () => {
      db.churchPastor.findMany.mockResolvedValueOnce([
        {
          pastor_id: 'p1',
          pastoral_role: 'Lead',
          image_asset_id: null,
          active_voice_profile_id: 'vo1',
          pastor: { name: 'Bob', introduction: null },
          active_voice_profile: {
            review_state: 'APPROVED',
            registration_state: 'READY',
            consent: null,
          },
        },
      ])

      const res = await GET_CHURCH_PASTORS({ churchIds: new Set(['c1']) })
      expect(res).toHaveLength(1)
      expect(res[0].voiceReady).toBe(true)
      expect(res[0].activeVoiceProfileId).toBe('vo1')

      expect(db.churchPastor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            active_voice_profile: {
              select: {
                review_state: true,
                registration_state: true,
                consent: { select: { revoked_at: true } },
              },
            },
          }),
        }),
      )
    })

    it('maps voiceReady: false when registration is PENDING', async () => {
      db.churchPastor.findMany.mockResolvedValueOnce([
        {
          pastor_id: 'p1',
          pastoral_role: 'Lead',
          image_asset_id: null,
          active_voice_profile_id: 'vo1',
          pastor: { name: 'Bob', introduction: null },
          active_voice_profile: {
            review_state: 'APPROVED',
            registration_state: 'PENDING',
            consent: null,
          },
        },
      ])

      const res = await GET_CHURCH_PASTORS({ churchIds: new Set(['c1']) })
      expect(res[0].voiceReady).toBe(false)
    })

    it('maps voiceReady: false when consent is revoked', async () => {
      db.churchPastor.findMany.mockResolvedValueOnce([
        {
          pastor_id: 'p1',
          pastoral_role: 'Lead',
          image_asset_id: null,
          active_voice_profile_id: 'vo1',
          pastor: { name: 'Bob', introduction: null },
          active_voice_profile: {
            review_state: 'APPROVED',
            registration_state: 'READY',
            consent: { revoked_at: new Date() },
          },
        },
      ])

      const res = await GET_CHURCH_PASTORS({ churchIds: new Set(['c1']) })
      expect(res[0].voiceReady).toBe(false)
    })

    it('returns empty array when churchIds is empty, skips fetch', async () => {
      const res = await GET_CHURCH_PASTORS({ churchIds: new Set() })
      expect(res).toEqual([])
      expect(db.churchPastor.findMany).not.toHaveBeenCalled()
    })
  })

  it('rejects a stale central profile update', async () => {
    tx.pastor.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      UPDATE_PASTOR(
        { pastorId: 'p1', expectedVersion: 2, payload: { name: 'Updated' } },
        tx as never,
      ),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
    expect(tx.pastor.findUnique).not.toHaveBeenCalled()
  })

  it('atomically increments and returns the central profile version', async () => {
    tx.pastor.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.pastor.findUnique.mockResolvedValueOnce({
      id: 'p1',
      version: 3,
      user_id: null,
      name: 'Updated',
      introduction: null,
      user: null,
      churchPastors: [],
    })

    const result = await UPDATE_PASTOR(
      { pastorId: 'p1', expectedVersion: 2, payload: { name: 'Updated' } },
      tx as never,
    )

    expect(tx.pastor.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', deleted_at: null, version: 2 },
      data: { name: 'Updated', version: { increment: 1 } },
    })
    expect(result.version).toBe(3)
  })
})

describe('GET_ASSIGNABLE_PASTOR_IMAGE', () => {
  it('accepts a General (church-less) ready image', async () => {
    db.mediaAsset.findFirst.mockResolvedValue({ id: 'a1' } as never)

    await GET_ASSIGNABLE_PASTOR_IMAGE({ churchId: 'c1', assetId: 'a1' })

    expect(db.mediaAsset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ church_id: null }]),
        }),
      }),
    )
  })
})
