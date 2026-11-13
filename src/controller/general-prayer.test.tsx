// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  list: vi.fn(),
  byId: vi.fn(),
  bySequence: vi.fn(),
  bySlug: vi.fn(),
  active: vi.fn(),
  activeCount: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setAudio: vi.fn(),
  enqueueAudio: vi.fn(),
  languages: vi.fn(),
  audit: vi.fn(async () => ({})),
}))

vi.mock('@/providers/general-prayer', () => ({
  LIST_GENERAL_PRAYERS: calls.list,
  GET_GENERAL_PRAYER_BY_ID: calls.byId,
  GET_GENERAL_PRAYER_BY_SEQUENCE: calls.bySequence,
  GET_GENERAL_PRAYER_BY_SLUG: calls.bySlug,
  LIST_ACTIVE_GENERAL_PRAYERS: calls.active,
  COUNT_ACTIVE_GENERAL_PRAYERS: calls.activeCount,
  CREATE_GENERAL_PRAYER: calls.create,
  UPDATE_GENERAL_PRAYER: calls.update,
  SET_GENERAL_PRAYER_AUDIO: calls.setAudio,
  ENQUEUE_GENERAL_PRAYER_AUDIO_JOB: calls.enqueueAudio,
}))
vi.mock('@/providers/church', () => ({ GET_AVAILABLE_LANGUAGE_CODES: calls.languages }))
vi.mock('@/utils/db-connection', () => ({ db: { auditLog: { create: calls.audit } } }))

import { Prisma } from '@prisma/client'
import {
  createGeneralPrayer,
  enqueueGeneralPrayerAudio,
  getGeneralPrayerBySlug,
  listGeneralPrayerCycle,
  updateGeneralPrayer,
} from './general-prayer'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'gp-1',
  slug: 'paivapalve-1',
  sequence: 1,
  title: 'Hoia oma jalga',
  introduction: null,
  body: '<p>Kes võib tulla Jumala ligi?</p>',
  verse: 'Hoia oma jalga',
  verse_reference: 'Kg 4,17',
  liturgical_note: null,
  references: null,
  language_code: 'et   ',
  audio_status: 'QUEUED',
  audio_asset_id: null,
  provider_request_id: null,
  last_error_code: null,
  audio_generated_at: null,
  is_active: true,
  version: 1,
  created_at: new Date('2026-11-01T00:00:00.000Z'),
  updated_at: null,
  audio_asset: null,
  ...over,
})

const input = {
  sequence: 1,
  title: 'Hoia oma jalga',
  body: '<p>Kes võib tulla Jumala ligi?</p>',
  languageCode: 'et',
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.languages.mockResolvedValue(new Set(['et   ']))
  calls.create.mockResolvedValue(row())
  calls.byId.mockResolvedValue(row())
  calls.update.mockResolvedValue(row({ version: 2 }))
})

describe('general prayer controller — writes', () => {
  it('sanitises the body before persist: a pasted script never reaches the database', async () => {
    await createGeneralPrayer({
      userId: 'admin',
      requestId: 'r1',
      input: {
        ...input,
        body: '<p>Päevapalve</p><script>alert(document.cookie)</script><p onclick="steal()">Aamen</p>',
      },
    })

    const persisted = calls.create.mock.calls[0][0] as { body: string }
    expect(persisted.body).not.toContain('<script')
    expect(persisted.body).not.toContain('onclick')
    expect(persisted.body).toContain('Päevapalve')
    expect(persisted.body).toContain('Aamen')
  })

  it('generates the public slug from the cycle position and stores a trimmed language code', async () => {
    await createGeneralPrayer({ userId: 'admin', requestId: 'r1', input })
    expect(calls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'paivapalve-1',
        sequence: 1,
        language_code: 'et',
        created_by: 'admin',
        is_active: true,
      }),
    )
  })

  it('refuses a body that sanitises to nothing (422 BODY_REQUIRED)', async () => {
    await expect(
      createGeneralPrayer({
        userId: 'admin',
        requestId: 'r1',
        input: { ...input, body: '<script>alert(document.cookie)</script>' },
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'BODY_REQUIRED' })
    expect(calls.create).not.toHaveBeenCalled()
  })

  it('answers 409 when the cycle position is taken', async () => {
    calls.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    )

    await expect(
      createGeneralPrayer({ userId: 'admin', requestId: 'r1', input }),
    ).rejects.toMatchObject({ code: 409, error_code: 'SEQUENCE_TAKEN' })
  })

  it('rejects an unknown or disabled language', async () => {
    calls.languages.mockResolvedValue(new Set())
    await expect(
      createGeneralPrayer({ userId: 'admin', requestId: 'r1', input }),
    ).rejects.toMatchObject({ code: 422, error_code: 'UNKNOWN_LANGUAGE' })
    expect(calls.create).not.toHaveBeenCalled()
  })

  it('leaves `sequence` untouched on update (it is the cycle position)', async () => {
    await updateGeneralPrayer({
      userId: 'admin',
      requestId: 'r1',
      generalPrayerId: 'gp-1',
      input: { version: 1, title: 'New title' },
    })

    const update = calls.update.mock.calls[0][0] as unknown as {
      expectedVersion: number
      data: Record<string, unknown>
    }
    expect(update.data).not.toHaveProperty('sequence')
    expect(update.data).not.toHaveProperty('slug')
    expect(update.expectedVersion).toBe(1)
  })

  it('does not rewrite the language on a title-only save', async () => {
    await updateGeneralPrayer({
      userId: 'admin',
      requestId: 'r1',
      generalPrayerId: 'gp-1',
      input: { version: 1, title: 'New title' },
    })
    const update = calls.update.mock.calls[0][0] as unknown as { data: Record<string, unknown> }
    expect(update.data).not.toHaveProperty('language_code')
    expect(update.data).not.toHaveProperty('is_active')
  })

  it('answers 409 STALE_VERSION for a stale editor save', async () => {
    calls.update.mockResolvedValue(null)
    await expect(
      updateGeneralPrayer({
        userId: 'admin',
        requestId: 'r1',
        generalPrayerId: 'gp-1',
        input: { version: 3, title: 'New title' },
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })

  it('strips unsafe HTML from an update as well', async () => {
    await updateGeneralPrayer({
      userId: 'admin',
      requestId: 'r1',
      generalPrayerId: 'gp-1',
      input: { version: 1, body: '<p>Aamen</p><iframe src="https://evil.test"></iframe>' },
    })

    const update = calls.update.mock.calls[0][0] as unknown as { data: { body: string } }
    expect(update.data.body).not.toContain('<iframe')
    expect(update.data.body).toContain('Aamen')
  })
})

describe('general prayer controller — audio', () => {
  it('answers 409 while a generation is already in flight', async () => {
    calls.byId.mockResolvedValue(row({ audio_status: 'GENERATING' }))
    await expect(enqueueGeneralPrayerAudio({ generalPrayerId: 'gp-1' })).rejects.toMatchObject({
      code: 409,
      error_code: 'AUDIO_GENERATING',
    })
    expect(calls.enqueueAudio).not.toHaveBeenCalled()
  })

  it('enqueues from QUEUED, FAILED and READY', async () => {
    for (const status of ['QUEUED', 'FAILED', 'READY']) {
      calls.byId.mockResolvedValue(row({ audio_status: status }))
      await expect(enqueueGeneralPrayerAudio({ generalPrayerId: 'gp-1' })).resolves.toBeTruthy()
    }
    expect(calls.enqueueAudio).toHaveBeenCalledTimes(3)
    expect(calls.enqueueAudio).toHaveBeenCalledWith({ generalPrayerId: 'gp-1', version: 1 })
  })
})

describe('general prayer controller — public reads', () => {
  it('returns null for an unknown slug instead of throwing', async () => {
    calls.bySlug.mockResolvedValue(null)
    await expect(getGeneralPrayerBySlug({ slug: 'nope' })).resolves.toBeNull()
  })

  it('never exposes the audio URL unless the asset is READY', async () => {
    // A public URL needs storage configured; the test env has no bucket.
    const previousBase = process.env.S3_PUBLIC_BASE_URL
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.test'
    calls.bySlug.mockResolvedValue(
      row({
        audio_status: 'READY',
        audio_asset_id: 'a1',
        audio_asset: {
          object_key: 'media/general_prayer/generated_audio/a.mp3',
          byte_size: BigInt(1_600_000),
          status: 'READY',
        },
      }),
    )
    const ready = await getGeneralPrayerBySlug({ slug: 'paivapalve-1' })
    expect(ready?.audioUrl).toMatch(/a\.mp3$/)
    expect(ready?.durationSeconds).toBe(100)

    calls.bySlug.mockResolvedValue(
      row({ audio_status: 'FAILED', audio_asset_id: null, audio_asset: null }),
    )
    const failed = await getGeneralPrayerBySlug({ slug: 'paivapalve-1' })
    expect(failed?.audioUrl).toBeNull()
    expect(failed?.durationSeconds).toBeNull()
    if (previousBase === undefined) delete process.env.S3_PUBLIC_BASE_URL
    else process.env.S3_PUBLIC_BASE_URL = previousBase
  })

  it('emits no audio URL when storage is not configured (text stays readable)', async () => {
    // The suite loads `.env` (which names a bucket) in other files, so this test
    // clears every storage variable itself instead of assuming an empty env.
    const storageVars = [
      'S3_PUBLIC_BASE_URL',
      'AWS_BUCKET_NAME',
      'S3_BUCKET',
      'AWS_BUCKET_NAME_ALT',
    ] as const
    const saved = storageVars.map((key) => [key, process.env[key]] as const)
    for (const key of storageVars) delete process.env[key]
    calls.bySlug.mockResolvedValue(
      row({
        audio_status: 'READY',
        audio_asset_id: 'a1',
        audio_asset: {
          object_key: 'media/general_prayer/generated_audio/a.mp3',
          byte_size: BigInt(1_600_000),
          status: 'READY',
        },
      }),
    )
    const detail = await getGeneralPrayerBySlug({ slug: 'paivapalve-1' })
    expect(detail?.audioUrl).toBeNull()
    expect(detail?.durationSeconds).toBeNull()
    expect(detail?.body).toContain('Kes võib tulla')
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('trims the fixed-width language code in every DTO', async () => {
    calls.bySlug.mockResolvedValue(row())
    const detail = await getGeneralPrayerBySlug({ slug: 'paivapalve-1' })
    expect(detail?.languageCode).toBe('et')
  })

  it('marks the cycle position for today and returns an empty cycle safely', async () => {
    calls.active.mockResolvedValue([row(), row({ id: 'gp-2', slug: 'paivapalve-2', sequence: 2 })])
    const cycle = await listGeneralPrayerCycle()
    expect(cycle.cycle).toHaveLength(2)
    expect(cycle.todaySequence).toBeGreaterThanOrEqual(1)
    expect(cycle.todaySequence).toBeLessThanOrEqual(2)

    calls.active.mockResolvedValue([])
    await expect(listGeneralPrayerCycle()).resolves.toEqual({ cycle: [], todaySequence: null })
  })
})
