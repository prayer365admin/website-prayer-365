// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db, auditPayloadMock } = vi.hoisted(() => {
  const dbMock = {
    prayer: {
      updateMany: vi.fn(),
    },
    prayerAudio: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    prayerVersion: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(dbMock)),
  }
  return { db: dbMock, auditPayloadMock: vi.fn((a) => a) }
})

vi.mock('@/utils/db-connection', () => ({ db }))
vi.mock('@/utils/audit', () => ({ auditPayload: auditPayloadMock }))

import { APPROVE_AUDIO, FINALIZE_AUDIO_READY } from './prayer-audio'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('APPROVE_AUDIO', () => {
  it('throws STALE_VERSION if the prayer version increment race fails (PR-09 Rule 3)', async () => {
    // mock the increment failing because the version mismatched
    db.prayer.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      APPROVE_AUDIO({
        churchIds: new Set(['c1']),
        prayerId: 'pr1',
        audioId: 'a1',
        expectedVersion: 3,
        prayerVersionId: 'v1',
        actorId: 'u1',
        requestId: 'req1',
      }),
    ).rejects.toMatchObject({
      code: 409,
      error_code: 'STALE_VERSION',
    })

    // ensure no subsequent operations were called after the race was lost
    expect(db.prayerAudio.findFirst).not.toHaveBeenCalled()
    expect(db.prayerAudio.update).not.toHaveBeenCalled()
    expect(db.prayerVersion.update).not.toHaveBeenCalled()
  })

  it('selects the audio when the version increment race succeeds', async () => {
    db.prayer.updateMany.mockResolvedValueOnce({ count: 1 })
    db.prayerAudio.findUnique.mockResolvedValueOnce({
      id: 'a1',
      prayer_version_id: 'v1',
      created_at: new Date(),
    })
    db.prayerAudio.findFirst.mockResolvedValueOnce({ id: 'a1', status: 'READY' })

    await APPROVE_AUDIO({
      churchIds: new Set(['c1']),
      prayerId: 'pr1',
      audioId: 'a1',
      expectedVersion: 3,
      prayerVersionId: 'v1',
      actorId: 'u1',
      requestId: 'req1',
    })

    expect(db.prayerVersion.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { selected_audio_id: 'a1' },
    })
  })
  it('throws 404 when findFirst (scoped to prayerVersionId) returns null', async () => {
    db.prayer.updateMany.mockResolvedValueOnce({ count: 1 })
    db.prayerAudio.findFirst.mockResolvedValueOnce(null)

    await expect(
      APPROVE_AUDIO({
        churchIds: new Set(['c1']),
        prayerId: 'pr1',
        audioId: 'a1',
        expectedVersion: 3,
        prayerVersionId: 'v1',
        actorId: 'u1',
        requestId: 'req1',
      }),
    ).rejects.toMatchObject({
      code: 404,
    })
  })

  it('throws 409 AUDIO_NOT_READY when findFirst returns status other than READY', async () => {
    db.prayer.updateMany.mockResolvedValueOnce({ count: 1 })
    db.prayerAudio.findFirst.mockResolvedValueOnce({ id: 'a1', status: 'QUEUED' })

    await expect(
      APPROVE_AUDIO({
        churchIds: new Set(['c1']),
        prayerId: 'pr1',
        audioId: 'a1',
        expectedVersion: 3,
        prayerVersionId: 'v1',
        actorId: 'u1',
        requestId: 'req1',
      }),
    ).rejects.toMatchObject({
      code: 409,
      error_code: 'AUDIO_NOT_READY',
    })
  })
})
describe('FINALIZE_AUDIO_READY', () => {
  it('strictly updates where status: { in: ["QUEUED", "GENERATING"] } and returns 0 count aborting safely', async () => {
    db.prayerAudio.updateMany.mockResolvedValueOnce({ count: 0 })

    const result = await FINALIZE_AUDIO_READY({
      churchId: 'c1',
      audioId: 'a1',
      assetId: 'asset1',
      providerRequestId: 'req1',
      requestId: 'req1',
    })

    expect(result).toEqual({ count: 0 })
    expect(db.prayerAudio.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'a1',
        status: { in: ['QUEUED', 'GENERATING'] },
      },
      data: expect.objectContaining({
        status: 'READY',
      }),
    })
  })
})
