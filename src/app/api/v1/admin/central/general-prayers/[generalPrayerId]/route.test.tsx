// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/general-prayer', () => ({
  listGeneralPrayers: vi.fn(),
  createGeneralPrayer: vi.fn(),
  getGeneralPrayer: vi.fn(),
  updateGeneralPrayer: vi.fn(),
  enqueueGeneralPrayerAudio: vi.fn(),
}))

import {
  enqueueGeneralPrayerAudio,
  getGeneralPrayer,
  updateGeneralPrayer,
} from '@/controller/general-prayer'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GeneralError } from '@/utils/general-error'
import { GET, PATCH } from './route'
import { POST as POST_AUDIO } from './audio/route'

const params = { params: Promise.resolve({ generalPrayerId: 'gp-1' }) }

const UNAUTH = new GeneralError({
  code: 401,
  error: 'Not Authenticated!',
  error_code: 'UNAUTHORIZED',
  details: 'Please login and try again!',
})
const NO_SCOPE = new GeneralError({
  code: 403,
  error: 'UNAUTHORIZED',
  error_code: 'NOT_ALLOWED',
  details: 'This account is not allowed for this action.',
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
  vi.mocked(requiredScope).mockResolvedValue({ churchIds: new Set() } as never)
})

describe('GET /admin/central/general-prayers/:generalPrayerId', () => {
  it('requires authentication (401)', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)
    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers/gp-1'),
      params,
    )
    expect(response.status).toBe(401)
    expect(getGeneralPrayer).not.toHaveBeenCalled()
  })

  it('requires the read scope (403)', async () => {
    vi.mocked(requiredScope).mockRejectedValue(NO_SCOPE)
    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers/gp-1'),
      params,
    )
    expect(response.status).toBe(403)
    expect(getGeneralPrayer).not.toHaveBeenCalled()
  })

  it('returns the detail', async () => {
    vi.mocked(getGeneralPrayer).mockResolvedValue({ id: 'gp-1' } as never)
    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers/gp-1'),
      params,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, result: { id: 'gp-1' } })
    expect(getGeneralPrayer).toHaveBeenCalledWith({ generalPrayerId: 'gp-1' })
  })

  it('answers 404 for an unknown id', async () => {
    vi.mocked(getGeneralPrayer).mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'General prayer not found.',
      }),
    )
    const response = await GET(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers/gp-9'),
      params,
    )
    expect(response.status).toBe(404)
  })
})

describe('PATCH /admin/central/general-prayers/:generalPrayerId', () => {
  const patch = (body: unknown) =>
    PATCH(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers/gp-1', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
      params,
    )

  it('requires the update scope (403)', async () => {
    vi.mocked(requiredScope).mockRejectedValue(NO_SCOPE)
    expect((await patch({ version: 1, title: 'x' })).status).toBe(403)
    expect(updateGeneralPrayer).not.toHaveBeenCalled()
  })

  it('requires an explicit version (422)', async () => {
    expect((await patch({ title: 'x' })).status).toBe(422)
    expect(updateGeneralPrayer).not.toHaveBeenCalled()
  })

  it('rejects an empty change set (422)', async () => {
    expect((await patch({ version: 2 })).status).toBe(422)
    expect(updateGeneralPrayer).not.toHaveBeenCalled()
  })

  it('refuses unknown or server-owned fields (mass assignment)', async () => {
    // slug, sequence, created_by and the audio columns are server-owned: a
    // PATCH that carries them is rejected outright, never partially applied.
    for (const extra of [
      { slug: 'paivapalve-999' },
      { sequence: 999 },
      { created_by: 'someone-else' },
      { audio_status: 'READY' },
      { audio_asset_id: 'asset-1' },
    ]) {
      expect((await patch({ version: 1, title: 'x', ...extra })).status).toBe(422)
    }
    expect(updateGeneralPrayer).not.toHaveBeenCalled()
  })

  it('relays a stale version as 409 STALE_VERSION', async () => {
    vi.mocked(updateGeneralPrayer).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'STALE_VERSION',
        details: 'This prayer has changed. Refresh and try again.',
      }),
    )
    const response = await patch({ version: 1, title: 'x' })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error_code: 'STALE_VERSION' })
  })

  it('updates and returns the new row', async () => {
    vi.mocked(updateGeneralPrayer).mockResolvedValue({ id: 'gp-1', version: 2 } as never)
    const response = await patch({ version: 1, title: 'x' })
    expect(response.status).toBe(200)
    expect(updateGeneralPrayer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin',
        generalPrayerId: 'gp-1',
        input: expect.objectContaining({ version: 1, title: 'x' }),
      }),
    )
  })
})

describe('POST /admin/central/general-prayers/:generalPrayerId/audio', () => {
  const post = () =>
    POST_AUDIO(
      new NextRequest('http://localhost/api/v1/admin/central/general-prayers/gp-1/audio', {
        method: 'POST',
      }),
      params,
    )

  it('requires authentication (401)', async () => {
    vi.mocked(requiredAuth).mockRejectedValue(UNAUTH)
    expect((await post()).status).toBe(401)
    expect(enqueueGeneralPrayerAudio).not.toHaveBeenCalled()
  })

  it('requires the update scope (403)', async () => {
    vi.mocked(requiredScope).mockRejectedValue(NO_SCOPE)
    expect((await post()).status).toBe(403)
    expect(requiredScope).toHaveBeenCalledWith({
      userId: 'admin',
      central: true,
      subject: 'prayer_general_prayer',
      action: 'update',
    })
    expect(enqueueGeneralPrayerAudio).not.toHaveBeenCalled()
  })

  it('answers 409 while a generation is already in flight', async () => {
    vi.mocked(enqueueGeneralPrayerAudio).mockRejectedValue(
      new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'AUDIO_GENERATING',
        details: 'Audio is already being generated for this prayer.',
      }),
    )
    const response = await post()
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error_code: 'AUDIO_GENERATING' })
  })

  it('queues the job and answers 202', async () => {
    vi.mocked(enqueueGeneralPrayerAudio).mockResolvedValue({
      id: 'gp-1',
      audioStatus: 'QUEUED',
    } as never)
    const response = await post()
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ success: true })
  })
})
