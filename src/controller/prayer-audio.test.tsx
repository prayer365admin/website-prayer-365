import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/prayer-audio', () => ({
  APPROVE_AUDIO: vi.fn(),
  CREATE_AUDIO: vi.fn(),
  CREATE_AUDIO_OUTBOX: vi.fn(),
  GET_AUDIO: vi.fn(),
  GET_READY_VOICE: vi.fn(),
  GET_VERSION: vi.fn(),
}))
vi.mock('@/utils/idempotency', () => ({ withIdempotency: vi.fn() }))

import {
  APPROVE_AUDIO,
  CREATE_AUDIO,
  CREATE_AUDIO_OUTBOX,
  GET_AUDIO,
  GET_READY_VOICE,
  GET_VERSION,
} from '@/providers/prayer-audio'
import { withIdempotency } from '@/utils/idempotency'
import { approveAudio, enqueueAudio, getAudio } from './prayer-audio'

const scope = new Set(['c1'])
const VERSION_ID = '00000000-0000-0000-0000-000000000001'
const VOICE_ID = '00000000-0000-0000-0000-000000000005'
const PRAYER_ID = '00000000-0000-0000-0000-000000000003'

const verse = { approved_at: new Date(), pastor_id: 'p1', text_hash: 'abc' }
const ctx = {
  prayer: { id: PRAYER_ID, version: 3, current_version_id: VERSION_ID },
  version: verse,
}
const voice = { consent: { revoked_at: null } }
const audioRow = {
  id: 'a1',
  prayer_version_id: VERSION_ID,
  prayer_id: PRAYER_ID,
  voice_profile_id: VOICE_ID,
  status: 'QUEUED',
  asset_id: null,
  provider_request_id: null,
  approved_by: null,
  approved_at: null,
  error_code: null,
  created_at: new Date(),
}

let run: ((tx: unknown) => Promise<string>) | null

beforeEach(() => {
  run = null
  vi.clearAllMocks()
  vi.mocked(withIdempotency).mockImplementation((async ({
    run: r,
  }: {
    run: (tx: unknown) => Promise<string>
  }) => {
    run = r
    return { fresh: true, resource_id: 'a1' }
  }) as never)
})

const fakeTx = () => ({
  prayerVersion: { findFirst: vi.fn().mockResolvedValue(verse) },
  auditLog: { create: vi.fn().mockResolvedValue({}) },
})

describe('enqueueAudio', () => {
  it('queues audio generation → 202, writing audio + outbox + audit once', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(ctx as never)
    vi.mocked(GET_READY_VOICE).mockResolvedValue(voice as never)
    vi.mocked(CREATE_AUDIO).mockResolvedValue({ id: 'a1' } as never)
    vi.mocked(CREATE_AUDIO_OUTBOX).mockResolvedValue({} as never)
    vi.mocked(GET_AUDIO).mockResolvedValue(audioRow as never)

    const res = await enqueueAudio({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      input: { version: 3, prayerVersionId: VERSION_ID, voiceProfileId: VOICE_ID },
      idempotencyKey: 'k1',
      requestId: 'r',
    })
    expect(res.status).toBe('QUEUED')

    // execute the durable business step in the idempotency transaction
    await run!(fakeTx())
    expect(CREATE_AUDIO).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'QUEUED', prayer_version_id: VERSION_ID }),
    )
    expect(CREATE_AUDIO_OUTBOX).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: 'audio.generate',
        dedupe_key: 'audio.generate:a1',
      }),
    )
    expect(withIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'audio.generate', key: 'k1' }),
    )
  })

  it('throws 409 WRONG_SNAPSHOT when not the current snapshot', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue({
      ...ctx,
      prayer: { ...ctx.prayer, current_version_id: 'other' },
    } as never)
    await expect(
      enqueueAudio({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input: { version: 3, prayerVersionId: VERSION_ID, voiceProfileId: VOICE_ID },
        idempotencyKey: 'k1',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'WRONG_SNAPSHOT' })
  })

  it('throws 409 GENERATION_BEFORE_APPROVAL when current text is not approved (generation before approval)', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(ctx as never)
    vi.mocked(GET_AUDIO).mockResolvedValue(audioRow as never)
    const tx = fakeTx()
    tx.prayerVersion.findFirst.mockResolvedValue({ ...verse, approved_at: null })
    await enqueueAudio({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      input: { version: 3, prayerVersionId: VERSION_ID, voiceProfileId: VOICE_ID },
      idempotencyKey: 'k1',
      requestId: 'r',
    }).catch(() => {})
    await expect(run!(tx)).rejects.toMatchObject({
      code: 409,
      error_code: 'GENERATION_BEFORE_APPROVAL',
    })
    expect(CREATE_AUDIO).not.toHaveBeenCalled()
  })

  it('throws 409 VOICE_NOT_READY when the voice is not provider-ready', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(ctx as never)
    vi.mocked(GET_READY_VOICE).mockResolvedValue(null as never)
    const tx = fakeTx()
    await enqueueAudio({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      input: { version: 3, prayerVersionId: VERSION_ID, voiceProfileId: VOICE_ID },
      idempotencyKey: 'k1',
      requestId: 'r',
    }).catch(() => {})
    await expect(run!(tx)).rejects.toMatchObject({ code: 409, error_code: 'VOICE_NOT_READY' })
  })

  it('throws 409 VOICE_CONSENT_REVOKED when consent is revoked', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(ctx as never)
    vi.mocked(GET_READY_VOICE).mockResolvedValue({ consent: { revoked_at: new Date() } } as never)
    const tx = fakeTx()
    await enqueueAudio({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      input: { version: 3, prayerVersionId: VERSION_ID, voiceProfileId: VOICE_ID },
      idempotencyKey: 'k1',
      requestId: 'r',
    }).catch(() => {})
    await expect(run!(tx)).rejects.toMatchObject({ code: 409, error_code: 'VOICE_CONSENT_REVOKED' })
  })

  it('throws 403 for a cross-church caller', async () => {
    await expect(
      enqueueAudio({
        userId: 'u1',
        churchId: 'c9',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input: { version: 3, prayerVersionId: VERSION_ID, voiceProfileId: VOICE_ID },
        idempotencyKey: 'k1',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('hides cross-church prayer (404) when the prayer is not in scope', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(null as never)
    await expect(
      enqueueAudio({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input: { version: 3, prayerVersionId: VERSION_ID, voiceProfileId: VOICE_ID },
        idempotencyKey: 'k1',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('getAudio', () => {
  it('returns audio state scoped to church/prayer', async () => {
    vi.mocked(GET_AUDIO).mockResolvedValue(audioRow as never)
    const res = await getAudio({ churchIds: scope, prayerId: PRAYER_ID, audioId: 'a1' })
    expect(res.prayerId).toBe(PRAYER_ID)
  })

  it('throws 404 when audio is out of scope', async () => {
    vi.mocked(GET_AUDIO).mockResolvedValue(null as never)
    await expect(
      getAudio({ churchIds: scope, prayerId: PRAYER_ID, audioId: 'a9' }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('approveAudio', () => {
  const action = { version: 3, prayerVersionId: VERSION_ID }

  it('approves and selects audio on the same snapshot', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(ctx as never)
    vi.mocked(APPROVE_AUDIO).mockResolvedValue({ ...audioRow, status: 'APPROVED' } as never)
    const res = await approveAudio({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      audioId: 'a1',
      input: action,
      requestId: 'r',
    })
    expect(APPROVE_AUDIO).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3, prayerVersionId: VERSION_ID, audioId: 'a1' }),
    )
    expect(res.status).toBe('APPROVED')
  })

  it('throws 409 WRONG_SNAPSHOT when not the current snapshot', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue({
      ...ctx,
      prayer: { ...ctx.prayer, current_version_id: 'other' },
    } as never)
    await expect(
      approveAudio({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        audioId: 'a1',
        input: action,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'WRONG_SNAPSHOT' })
  })
  it('throws 409 stale on version mismatch', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue({
      ...ctx,
      prayer: { ...ctx.prayer, version: 9 },
    } as never)
    await expect(
      approveAudio({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        audioId: 'a1',
        input: action,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })
})
