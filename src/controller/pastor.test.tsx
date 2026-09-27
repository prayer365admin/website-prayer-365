import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/church', () => ({ GET_CHURCH_VERSION: vi.fn() }))
vi.mock('@/providers/pastor', () => ({
  GET_CHURCH_PASTOR: vi.fn(),
  GET_CHURCH_PASTORS: vi.fn(),
  GET_CHURCH_READY_IMAGE: vi.fn(),
  UPDATE_CHURCH_PASTOR: vi.fn(),
}))

import { GET_CHURCH_VERSION } from '@/providers/church'
import {
  GET_CHURCH_PASTOR,
  GET_CHURCH_PASTORS,
  GET_CHURCH_READY_IMAGE,
  UPDATE_CHURCH_PASTOR,
} from '@/providers/pastor'
import { getChurchPastor, getChurchPastors, patchChurchPastor } from './pastor'

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
})
