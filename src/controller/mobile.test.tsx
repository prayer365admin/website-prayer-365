import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/mobile', () => ({
  CREATE_ANALYTICS_EVENTS: vi.fn(),
  CREATE_CHECKIN: vi.fn(),
  COUNT_RECENT_USER_REQUESTS: vi.fn(),
  CREATE_USER_REQUEST: vi.fn(),
  GET_HOME: vi.fn(),
  GET_ME_PROFILE: vi.fn(),
  GET_PUBLIC_CHURCH: vi.fn(),
  GET_PUBLISHED_PRAYER: vi.fn(),
  GET_USER_REQUEST_ACK: vi.fn(),
  LIST_MY_CHURCHES: vi.fn(),
  LIST_PUBLIC_ANNOUNCEMENTS: vi.fn(),
  LIST_PUBLIC_CHURCHES: vi.fn(),
  LIST_PUBLIC_EVENTS: vi.fn(),
  LIST_PUBLISHED_PRAYERS: vi.fn(),
  SET_FOLLOW: vi.fn(),
  UPDATE_ME_PROFILE: vi.fn(),
}))
vi.mock('@/utils/idempotency', () => ({ withIdempotency: vi.fn() }))

import {
  CREATE_ANALYTICS_EVENTS,
  CREATE_CHECKIN,
  COUNT_RECENT_USER_REQUESTS,
  CREATE_USER_REQUEST,
  GET_ME_PROFILE,
  GET_PUBLIC_CHURCH,
  GET_PUBLISHED_PRAYER,
  GET_USER_REQUEST_ACK,
  LIST_PUBLISHED_PRAYERS,
  SET_FOLLOW,
  UPDATE_ME_PROFILE,
} from '@/providers/mobile'
import { MobileMePatchSchema } from '@/models/mobile'
import { withIdempotency } from '@/utils/idempotency'
import {
  checkIn,
  getMe,
  getPublicChurch,
  getPublishedPrayer,
  listPublishedPrayers,
  patchMe,
  recordAnalyticsEvents,
  setFollow,
  submitRequest,
} from './mobile'

const CHURCH = {
  id: 'c1',
  name: 'Grace',
  denomination: null,
  description: 'x',
  timezone: 'UTC',
  address: {},
  coordinates: null,
  contacts: {},
  website: null,
  socialLinks: [],
  accessibility: null,
  coverAssetId: null,
  languageCodes: [],
  serviceTimes: [],
  distanceKm: null,
}

beforeEach(() => vi.clearAllMocks())

describe('Task 39 / discovery — approved church gating', () => {
  it('getPublicChurch returns the public profile for an approved church', async () => {
    vi.mocked(GET_PUBLIC_CHURCH).mockResolvedValue(CHURCH as never)
    const res = await getPublicChurch({ churchId: 'c1', query: {} as never })
    expect(res.id).toBe('c1')
    // public profile must never carry private fields
    expect(res).not.toHaveProperty('approved_by')
    expect(res).not.toHaveProperty('approved_at')
    expect(res).not.toHaveProperty('status')
  })

  it('getPublicChurch hides an unapproved/suspended church as 404', async () => {
    vi.mocked(GET_PUBLIC_CHURCH).mockResolvedValue(null as never)
    await expect(
      getPublicChurch({ churchId: 'c-suspended', query: {} as never }),
    ).rejects.toMatchObject({
      code: 404,
    })
  })

  it('listPublishedPrayers rejects a not-approved church with 404 (no leak)', async () => {
    vi.mocked(GET_PUBLIC_CHURCH).mockResolvedValue(null as never)
    await expect(
      listPublishedPrayers({ churchId: 'c-pending', query: {} as never }),
    ).rejects.toMatchObject({ code: 404 })
    expect(LIST_PUBLISHED_PRAYERS).not.toHaveBeenCalled()
  })
})

describe('Task 41 / published prayer — draft not served', () => {
  it('getPublishedPrayer returns published prayer with approved audio snapshot', async () => {
    vi.mocked(GET_PUBLISHED_PRAYER).mockResolvedValue({
      id: 'p1',
      churchId: 'c1',
      publishedAt: '2026-01-01T00:00:00Z',
      version: {
        prayerVersionId: 'v9',
        versionNumber: 9,
        pastorId: 'pa',
        title: 'T',
        introduction: null,
        body: 'B',
        languageCode: 'en',
      },
      audio: {
        prayerAudioId: 'a1',
        assetId: 'm1',
        assetKey: 'audio/1.mp3',
        approvedAt: '2026-01-01T00:00:00Z',
      },
    } as never)
    const res = await getPublishedPrayer({ prayerId: 'p1' })
    expect(res.version.versionNumber).toBe(9)
    expect(res.audio?.assetKey).toBe('audio/1.mp3')
  })

  it('getPublishedPrayer throws 404 for a draft/unpublished prayer', async () => {
    vi.mocked(GET_PUBLISHED_PRAYER).mockResolvedValue(null as never)
    await expect(getPublishedPrayer({ prayerId: 'draft' })).rejects.toMatchObject({ code: 404 })
  })
})

describe('Task 40 / me — subject only, single main church', () => {
  it('getMe throws 404 when the user is missing', async () => {
    vi.mocked(GET_ME_PROFILE).mockResolvedValue(null as never)
    await expect(getMe({ userId: 'u1' })).rejects.toMatchObject({ code: 404 })
  })

  it('patchMe sets ONE main church transactionally (clears others)', async () => {
    vi.mocked(GET_ME_PROFILE).mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      locale: null,
      profilePicture: null,
      mainChurchId: 'c1',
      mainChurchName: 'Grace',
    } as never)
    const res = await patchMe({ userId: 'u1', data: { mainChurchId: 'c2' } })
    expect(UPDATE_ME_PROFILE).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', mainChurchId: 'c2' }),
    )
    expect(res.mainChurchId).toBe('c2')
  })

  it('patchMe persists a profilePicture URL and returns it', async () => {
    vi.mocked(GET_ME_PROFILE).mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      locale: null,
      profilePicture: null,
      mainChurchId: null,
      mainChurchName: null,
    } as never)
    const res = await patchMe({
      userId: 'u1',
      data: { profilePicture: 'https://cdn.example.com/a.png' },
    })
    expect(UPDATE_ME_PROFILE).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', profilePicture: 'https://cdn.example.com/a.png' }),
    )
    expect(res.profilePicture).toBe('https://cdn.example.com/a.png')
  })

  it('patchMe clears the avatar when profilePicture is explicitly null', async () => {
    vi.mocked(GET_ME_PROFILE).mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      locale: null,
      profilePicture: 'https://cdn.example.com/old.png',
      mainChurchId: null,
      mainChurchName: null,
    } as never)
    const res = await patchMe({ userId: 'u1', data: { profilePicture: null } })
    expect(UPDATE_ME_PROFILE).toHaveBeenCalledWith(
      expect.objectContaining({ profilePicture: null }),
    )
    expect(res.profilePicture).toBeNull()
  })

  it('patchMe leaves the existing avatar untouched when profilePicture is absent', async () => {
    vi.mocked(GET_ME_PROFILE).mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      name: 'A',
      locale: null,
      profilePicture: 'https://cdn.example.com/keep.png',
      mainChurchId: null,
      mainChurchName: null,
    } as never)
    const res = await patchMe({ userId: 'u1', data: { name: 'New' } })
    expect(UPDATE_ME_PROFILE).toHaveBeenCalledWith(
      expect.objectContaining({ profilePicture: 'https://cdn.example.com/keep.png' }),
    )
    expect(res.profilePicture).toBe('https://cdn.example.com/keep.png')
  })

  it('setFollow rejects a non-approved church as 404', async () => {
    vi.mocked(SET_FOLLOW).mockResolvedValue(null as never)
    await expect(
      setFollow({ userId: 'u1', churchId: 'c-archived', isFollowed: true }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('Task 43 / requests — idempotent ack', () => {
  it('requires subject for a prayer request', async () => {
    vi.mocked(GET_PUBLIC_CHURCH).mockResolvedValue(CHURCH as never)
    await expect(
      submitRequest({
        userId: 'u1',
        churchId: 'c1',
        input: { kind: 'prayer', message: 'hi', contactMethod: 'in_app' },
        idempotencyKey: 'k1',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'SUBJECT_REQUIRED' })
    expect(withIdempotency).not.toHaveBeenCalled()
  })

  it('acknowledges a fresh submission and scopes the idempotency body to the church', async () => {
    vi.mocked(GET_PUBLIC_CHURCH).mockResolvedValue(CHURCH as never)
    vi.mocked(COUNT_RECENT_USER_REQUESTS).mockResolvedValue(0)
    vi.mocked(CREATE_USER_REQUEST).mockResolvedValue({
      id: 'req-1',
      kind: 'pastoral',
      createdAt: '2026-01-01T00:00:00Z',
    } as never)
    vi.mocked(withIdempotency).mockImplementation(async ({ run }) => {
      await run({} as never)
      return { fresh: true, resource_id: 'req-1' }
    })
    const input = { kind: 'pastoral' as const, message: 'hi', contactMethod: 'in_app' }
    const first = await submitRequest({
      userId: 'u1',
      churchId: 'c1',
      input,
      idempotencyKey: 'k1',
      requestId: 'r',
    })
    expect(first).toEqual({ id: 'req-1', kind: 'pastoral', createdAt: '2026-01-01T00:00:00Z' })
    expect(withIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'request.submit',
        key: 'k1',
        requestBody: { churchId: 'c1', ...input },
      }),
    )
    expect(GET_USER_REQUEST_ACK).not.toHaveBeenCalled()
  })

  it('returns the original ack on a replay (lost-response recovery)', async () => {
    vi.mocked(GET_PUBLIC_CHURCH).mockResolvedValue(CHURCH as never)
    // Replay: withIdempotency does not call run, it returns the stored resource id.
    vi.mocked(withIdempotency).mockResolvedValue({ fresh: false, resource_id: 'req-1' } as never)
    const original = { id: 'req-1', kind: 'meeting', createdAt: '2026-01-01T00:00:00.000Z' }
    vi.mocked(GET_USER_REQUEST_ACK).mockResolvedValue(original)
    const res = await submitRequest({
      userId: 'u1',
      churchId: 'c1',
      input: { kind: 'meeting', message: 'hi', contactMethod: 'in_app' },
      idempotencyKey: 'k1',
      requestId: 'r',
    })
    expect(res).toEqual(original)
    expect(GET_USER_REQUEST_ACK).toHaveBeenCalledWith({ id: 'req-1', userId: 'u1' })
    expect(CREATE_USER_REQUEST).not.toHaveBeenCalled()
    expect(COUNT_RECENT_USER_REQUESTS).not.toHaveBeenCalled()
  })

  it('rate-limits fresh submissions with 429 and writes nothing', async () => {
    vi.mocked(GET_PUBLIC_CHURCH).mockResolvedValue(CHURCH as never)
    vi.mocked(COUNT_RECENT_USER_REQUESTS).mockResolvedValue(5)
    vi.mocked(withIdempotency).mockImplementation(async ({ run }) => {
      const id = await run({} as never)
      return { fresh: true, resource_id: id }
    })
    await expect(
      submitRequest({
        userId: 'u1',
        churchId: 'c1',
        input: { kind: 'prayer', subject: 's', message: 'hi', contactMethod: 'in_app' },
        idempotencyKey: 'k6',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 429, error_code: 'RATE_LIMITED' })
    expect(CREATE_USER_REQUEST).not.toHaveBeenCalled()
    // Counted per user across churches: no church filter is passed.
    expect(COUNT_RECENT_USER_REQUESTS).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
    )
    expect(vi.mocked(COUNT_RECENT_USER_REQUESTS).mock.calls[0][0]).not.toHaveProperty('churchId')
  })

  it('honours REQUEST_SUBMIT_LIMIT from the environment', async () => {
    vi.stubEnv('REQUEST_SUBMIT_LIMIT', '10')
    vi.mocked(GET_PUBLIC_CHURCH).mockResolvedValue(CHURCH as never)
    vi.mocked(COUNT_RECENT_USER_REQUESTS).mockResolvedValue(5)
    vi.mocked(CREATE_USER_REQUEST).mockResolvedValue({
      id: 'req-6',
      kind: 'prayer',
      createdAt: '2026-01-01T00:00:00Z',
    } as never)
    vi.mocked(withIdempotency).mockImplementation(async ({ run }) => {
      const id = await run({} as never)
      return { fresh: true, resource_id: id }
    })
    const res = await submitRequest({
      userId: 'u1',
      churchId: 'c1',
      input: { kind: 'prayer', subject: 's', message: 'hi', contactMethod: 'in_app' },
      idempotencyKey: 'k6',
      requestId: 'r',
    })
    expect(res.id).toBe('req-6')
    vi.unstubAllEnvs()
  })
})

describe('Task 43 / check-in — idempotent ack', () => {
  it('runs the check-in inside withIdempotency', async () => {
    vi.mocked(withIdempotency).mockImplementation(async ({ run }) => {
      const id = await run({} as never)
      return { fresh: true, resource_id: id }
    })
    vi.mocked(CREATE_CHECKIN).mockResolvedValue({
      id: 'ck-1',
      churchId: 'c1',
      occurredAt: '2026-01-01T00:00:00Z',
      localDate: '2026-01-01',
    } as never)
    const res = await checkIn({
      userId: 'u1',
      churchId: 'c1',
      idempotencyKey: 'k1',
      requestId: 'r',
    })
    expect(CREATE_CHECKIN).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', userId: 'u1' }),
    )
    expect(withIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'checkin.create', key: 'k1' }),
    )
    expect(res.localDate).toBe('2026-01-01')
  })
})

describe('MobileMePatchSchema — profilePicture is additive + URL-validated', () => {
  it('accepts a valid https URL and null (clear)', () => {
    expect(
      MobileMePatchSchema.safeParse({ profilePicture: 'https://cdn.example.com/a.png' }).success,
    ).toBe(true)
    expect(MobileMePatchSchema.safeParse({ profilePicture: null }).success).toBe(true)
  })

  it('keeps the existing fields working (additive, still strict)', () => {
    expect(MobileMePatchSchema.safeParse({ name: 'A' }).success).toBe(true)
    expect(MobileMePatchSchema.safeParse({ name: 'A', locale: null }).success).toBe(true)
  })

  it('rejects an invalid URL, an empty string, and unknown keys', () => {
    expect(MobileMePatchSchema.safeParse({ profilePicture: 'not-a-url' }).success).toBe(false)
    expect(MobileMePatchSchema.safeParse({ profilePicture: '' }).success).toBe(false)
    expect(
      MobileMePatchSchema.safeParse({ profilePicture: 'https://x/y.png', userId: 'attacker' })
        .success,
    ).toBe(false)
  })
})

describe('Task 43 / analytics — bounded, allowlisted at route', () => {
  it('records allowlisted events', async () => {
    vi.mocked(CREATE_ANALYTICS_EVENTS).mockResolvedValue({ accepted: 2 } as never)
    const res = await recordAnalyticsEvents({
      userId: 'u1',
      input: {
        events: [
          { eventType: 'app_open', occurredAt: '2026-01-01T00:00:00Z' },
          { eventType: 'prayer_listen', occurredAt: '2026-01-01T00:00:01Z' },
        ],
      },
      requestId: 'r',
    })
    expect(res.accepted).toBe(2)
  })
})
