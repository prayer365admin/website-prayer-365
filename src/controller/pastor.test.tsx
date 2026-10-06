import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ auditLog: { create: vi.fn() } }),
  ),
}))
vi.mock('@/providers/church', () => ({ GET_CHURCH_VERSION: vi.fn() }))
vi.mock('@/providers/pastor', () => ({
  CREATE_PASTOR: vi.fn(),
  DELETE_CHURCH_PASTOR: vi.fn(),
  DELETE_PASTOR: vi.fn(),
  DELETE_CHURCH_PASTORS_NOT_IN: vi.fn(),
  GET_ASSIGNABLE_PASTOR_IMAGE: vi.fn(),
  GET_ASSIGNABLE_PROFILE_IMAGE: vi.fn(),
  GET_ASSIGNABLE_VOICE_PROFILE: vi.fn(),
  GET_CHURCH_BY_ID: vi.fn(),
  GET_CHURCH_PASTOR: vi.fn(),
  GET_CHURCH_PASTORS: vi.fn(),
  GET_CHURCH_READY_IMAGE: vi.fn(),
  GET_PASTOR_BY_ID: vi.fn(),
  GET_PASTOR_BY_USER_ID: vi.fn(),
  GET_PASTOR_USAGE: vi.fn(),
  GET_PASTORS: vi.fn(),
  GET_USER_BY_ID: vi.fn(),
  UPDATE_CHURCH_PASTOR: vi.fn(),
  UPDATE_PASTOR: vi.fn(),
  UPSERT_CHURCH_PASTOR: vi.fn(),
}))

import { GET_CHURCH_VERSION } from '@/providers/church'
import {
  GET_CHURCH_PASTOR,
  GET_CHURCH_PASTORS,
  GET_CHURCH_READY_IMAGE,
  GET_ASSIGNABLE_PASTOR_IMAGE,
  GET_ASSIGNABLE_PROFILE_IMAGE,
  GET_ASSIGNABLE_VOICE_PROFILE,
  CREATE_PASTOR,
  DELETE_CHURCH_PASTOR,
  DELETE_PASTOR,
  DELETE_CHURCH_PASTORS_NOT_IN,
  GET_CHURCH_BY_ID,
  GET_PASTOR_BY_ID,
  GET_PASTOR_USAGE,
  GET_PASTOR_BY_USER_ID,
  GET_USER_BY_ID,
  UPDATE_CHURCH_PASTOR,
  UPDATE_PASTOR,
  UPSERT_CHURCH_PASTOR,
} from '@/providers/pastor'
import {
  createPastor,
  deletePastor,
  getChurchPastor,
  getChurchPastors,
  patchChurchPastor,
  putChurchPastors,
  unassignPastorFromChurch,
  updatePastor,
} from './pastor'

const row = { id: 'p1', name: 'A', introduction: null, pastoralRole: 'Lead', imageAssetId: null }

beforeEach(() => vi.clearAllMocks())

describe('getChurchPastors', () => {
  it('returns assigned pastors', async () => {
    vi.mocked(GET_CHURCH_PASTORS).mockResolvedValue([row] as never)
    await expect(getChurchPastors({ churchIds: new Set(['c1']) })).resolves.toHaveLength(1)
  })

  it('throws 404 for an empty scope', async () => {
    await expect(getChurchPastors({ churchIds: new Set() })).rejects.toMatchObject({ code: 404 })
  })
})

describe('getChurchPastor', () => {
  it('throws 404 when the assignment is not found', async () => {
    vi.mocked(GET_CHURCH_PASTOR).mockResolvedValue(null as never)
    await expect(
      getChurchPastor({ churchIds: new Set(['c1']), pastorId: 'p9' }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('patchChurchPastor', () => {
  const scope = new Set(['c1'])
  const input = { version: 3, pastoral_role: 'Associate' }

  it('throws 403 for an out-of-scope church (cross-church hidden)', async () => {
    await expect(
      patchChurchPastor({
        userId: 'u1',
        churchId: 'c9',
        churchIds: new Set(['c1']),
        pastorId: 'p1',
        input,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('throws 409 STALE_VERSION on version mismatch', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(9 as never)
    await expect(
      patchChurchPastor({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        pastorId: 'p1',
        input,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })

  it('throws 422 for a foreign/not-ready image asset', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(GET_CHURCH_READY_IMAGE).mockResolvedValue(null as never)
    await expect(
      patchChurchPastor({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        pastorId: 'p1',
        input: { version: 3, image_asset_id: '00000000-0000-0000-0000-000000000000' },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_IMAGE_ASSET' })
  })

  it('updates the church-scoped assignment', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(UPDATE_CHURCH_PASTOR).mockResolvedValue({
      ...row,
      pastoralRole: 'Associate',
    } as never)
    const res = await patchChurchPastor({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      pastorId: 'p1',
      input,
      requestId: 'r',
    })
    expect(res.pastoralRole).toBe('Associate')
    expect(UPDATE_CHURCH_PASTOR).toHaveBeenCalledWith(
      expect.objectContaining({ pastorId: 'p1', expectedVersion: 3, pastoralRole: 'Associate' }),
    )
  })

  it('leaves the stored church image untouched when the patch omits image_asset_id', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(UPDATE_CHURCH_PASTOR).mockResolvedValue(row as never)

    await patchChurchPastor({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      pastorId: 'p1',
      input,
      requestId: 'r',
    })

    const [firstCall] = vi.mocked(UPDATE_CHURCH_PASTOR).mock.calls
    expect(firstCall[0].imageAssetId).toBeUndefined()
    expect(GET_CHURCH_READY_IMAGE).not.toHaveBeenCalled()
  })

  it('clears the church image only when image_asset_id is explicitly null', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(UPDATE_CHURCH_PASTOR).mockResolvedValue(row as never)

    await patchChurchPastor({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      pastorId: 'p1',
      input: { version: 3, image_asset_id: null },
      requestId: 'r',
    })

    const [firstCall] = vi.mocked(UPDATE_CHURCH_PASTOR).mock.calls
    expect(firstCall[0].imageAssetId).toBeNull()
  })
})

describe('central pastor profiles and assignments', () => {
  it('creates a pastor profile without requiring a staff login', async () => {
    vi.mocked(CREATE_PASTOR).mockResolvedValue({
      id: 'p2',
      name: 'Pastor B',
      introduction: null,
      user_id: null,
    } as never)

    await expect(
      createPastor({
        payload: { name: 'Pastor B' },
        actorId: 'admin',
        requestId: 'r',
      }),
    ).resolves.toMatchObject({ id: 'p2', user_id: null })

    expect(CREATE_PASTOR).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pastor B', user_id: null }),
      expect.anything(),
    )
  })

  it('replaces church assignments without deleting pastor profiles', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(GET_PASTOR_BY_ID).mockResolvedValue({ id: 'p1' } as never)

    await putChurchPastors({
      churchId: 'c1',
      payload: {
        assigned: [{ pastorId: 'p1', pastoralRole: 'Lead pastor' }],
      },
      actorId: 'admin',
      requestId: 'r',
    })

    expect(UPSERT_CHURCH_PASTOR).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'c1',
        pastorId: 'p1',
        pastoralRole: 'Lead pastor',
      }),
      expect.anything(),
    )
    expect(DELETE_CHURCH_PASTORS_NOT_IN).toHaveBeenCalledWith(
      { churchId: 'c1', pastorIds: ['p1'] },
      expect.anything(),
    )
  })

  it('passes the expected version to the central profile update', async () => {
    vi.mocked(GET_PASTOR_BY_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(UPDATE_PASTOR).mockResolvedValue({ id: 'p1', version: 4 } as never)

    await updatePastor({
      pastorId: 'p1',
      payload: { version: 3, name: 'Updated' },
      actorId: 'admin',
      requestId: 'r',
    })

    expect(UPDATE_PASTOR).toHaveBeenCalledWith(
      expect.objectContaining({ pastorId: 'p1', expectedVersion: 3 }),
      expect.anything(),
    )
  })

  it('links a staff identity by changing only the pastor profile', async () => {
    vi.mocked(GET_PASTOR_BY_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(GET_USER_BY_ID).mockResolvedValue({ id: 'u1' } as never)
    vi.mocked(GET_PASTOR_BY_USER_ID).mockResolvedValue(null as never)
    vi.mocked(UPDATE_PASTOR).mockResolvedValue({ id: 'p1', version: 4, user_id: 'u1' } as never)

    await updatePastor({
      pastorId: 'p1',
      payload: { version: 3, introduction: 'Updated biography', userId: 'u1' },
      actorId: 'admin',
      requestId: 'r',
    })

    expect(UPDATE_PASTOR).toHaveBeenCalledWith(
      {
        pastorId: 'p1',
        expectedVersion: 3,
        payload: {
          name: undefined,
          introduction: 'Updated biography',
          user_id: 'u1',
        },
      },
      expect.anything(),
    )
  })

  it('accepts a canonical image only when it belongs to an assigned church', async () => {
    vi.mocked(GET_PASTOR_BY_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(GET_ASSIGNABLE_PROFILE_IMAGE).mockResolvedValue({
      id: 'asset-1',
      church_id: 'c1',
    } as never)
    vi.mocked(UPDATE_PASTOR).mockResolvedValue({ id: 'p1', version: 4 } as never)

    await updatePastor({
      pastorId: 'p1',
      payload: {
        version: 3,
        imageAssetId: '00000000-0000-0000-0000-000000000001',
      },
      actorId: 'admin',
      requestId: 'r',
    })

    expect(GET_ASSIGNABLE_PROFILE_IMAGE).toHaveBeenCalledWith({
      pastorId: 'p1',
      assetId: '00000000-0000-0000-0000-000000000001',
    })
    expect(UPDATE_PASTOR).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          image_asset_id: '00000000-0000-0000-0000-000000000001',
        }),
      }),
      expect.anything(),
    )
  })

  it('unassigns only the church relationship and keeps the pastor profile', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(DELETE_CHURCH_PASTOR).mockResolvedValue({ church_id: 'c1', pastor_id: 'p1' } as never)

    await unassignPastorFromChurch({
      churchId: 'c1',
      pastorId: 'p1',
      actorId: 'admin',
      requestId: 'r',
    })

    expect(DELETE_CHURCH_PASTOR).toHaveBeenCalledWith(
      { churchId: 'c1', pastorId: 'p1' },
      expect.anything(),
    )
    expect(DELETE_PASTOR).not.toHaveBeenCalled()
  })

  it('rejects deletion while the pastor is referenced', async () => {
    vi.mocked(GET_PASTOR_BY_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(GET_PASTOR_USAGE).mockResolvedValue({
      id: 'p1',
      _count: { churchPastors: 1, prayerVersions: 0, voiceProfiles: 0, consents: 0 },
    } as never)

    await expect(
      deletePastor({ pastorId: 'p1', actorId: 'admin', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'PASTOR_IN_USE' })
    expect(DELETE_PASTOR).not.toHaveBeenCalled()
  })

  it('rejects deletion when a historical prayer version attributes the pastor', async () => {
    vi.mocked(GET_PASTOR_BY_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(GET_PASTOR_USAGE).mockResolvedValue({
      id: 'p1',
      _count: { churchPastors: 0, prayerVersions: 1, voiceProfiles: 0, consents: 0 },
    } as never)

    await expect(
      deletePastor({ pastorId: 'p1', actorId: 'admin', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'PASTOR_IN_USE' })
    expect(DELETE_PASTOR).not.toHaveBeenCalled()
  })

  it('rejects a central assignment with a foreign or unready image', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(GET_PASTOR_BY_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(GET_ASSIGNABLE_PASTOR_IMAGE).mockResolvedValue(null as never)

    await expect(
      putChurchPastors({
        churchId: 'c1',
        payload: {
          assigned: [
            {
              pastorId: 'p1',
              imageAssetId: '00000000-0000-0000-0000-000000000001',
            },
          ],
        },
        actorId: 'admin',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_IMAGE_ASSET' })
    expect(UPSERT_CHURCH_PASTOR).not.toHaveBeenCalled()
  })

  it('rejects an active voice that is not eligible for the pastor and church', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({ id: 'c1' } as never)
    vi.mocked(GET_PASTOR_BY_ID).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(GET_ASSIGNABLE_VOICE_PROFILE).mockResolvedValue({
      id: 'v1',
      church_id: 'other-church',
      pastor_id: 'p1',
      review_state: 'APPROVED',
      registration_state: 'READY',
      consent: { pastor_id: 'p1', purpose: 'voice_cloning', revoked_at: null },
    } as never)

    await expect(
      putChurchPastors({
        churchId: 'c1',
        payload: { assigned: [{ pastorId: 'p1', activeVoiceProfileId: 'v1' }] },
        actorId: 'admin',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_ACTIVE_VOICE_PROFILE' })
    expect(UPSERT_CHURCH_PASTOR).not.toHaveBeenCalled()
  })
})
