import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/prayer', () => ({
  APPROVE_TEXT: vi.fn(),
  CREATE_PRAYER_WITH_VERSION: vi.fn(),
  CREATE_VERSION_SNAPSHOT: vi.fn(),
  GET_PRAYER: vi.fn(),
  GET_VERSION: vi.fn(),
  LIST_PRAYERS: vi.fn(),
  SCHEDULE_PRAYER: vi.fn(),
}))
vi.mock('@/providers/pastor', () => ({ GET_CHURCH_PASTOR: vi.fn() }))
vi.mock('@/providers/church', () => ({ GET_AVAILABLE_LANGUAGE_CODES: vi.fn() }))
vi.mock('@/utils/idempotency', () => ({ withIdempotency: vi.fn() }))

import {
  APPROVE_TEXT,
  CREATE_PRAYER_WITH_VERSION,
  CREATE_VERSION_SNAPSHOT,
  GET_PRAYER,
  GET_VERSION,
  LIST_PRAYERS,
  SCHEDULE_PRAYER,
} from '@/providers/prayer'
import { GET_CHURCH_PASTOR } from '@/providers/pastor'
import { GET_AVAILABLE_LANGUAGE_CODES } from '@/providers/church'
import { withIdempotency } from '@/utils/idempotency'
import {
  approveText,
  createPrayer,
  getPrayer,
  listPrayers,
  patchPrayer,
  publishPrayer,
  schedulePrayer,
} from './prayer'

const scope = new Set(['c1'])
const VERSION_ID = '00000000-0000-0000-0000-000000000001'
const PASTOR_ID = '00000000-0000-0000-0000-000000000002'
const PRAYER_ID = '00000000-0000-0000-0000-000000000003'

const input = {
  title: 'My Prayer',
  introduction: null,
  body: 'Amen.',
  pastorId: PASTOR_ID,
  languageCode: 'en',
}

const ctx = {
  prayer: { id: PRAYER_ID, version: 3, current_version_id: VERSION_ID },
  version: { id: VERSION_ID, approved_at: new Date(), pastor_id: PASTOR_ID },
}

const prayerOut = {
  id: PRAYER_ID,
  churchId: 'c1',
  version: 4,
  current: null,
  published: null,
  scheduled: null,
  textApproved: true,
}

beforeEach(() => vi.clearAllMocks())

describe('listPrayers', () => {
  it('delegates to LIST_PRAYERS', async () => {
    vi.mocked(LIST_PRAYERS).mockResolvedValue({ result: [], total: 0 } as never)
    await expect(listPrayers({ churchIds: scope, query: {} as never })).resolves.toEqual({
      result: [],
      total: 0,
    })
    expect(LIST_PRAYERS).toHaveBeenCalled()
  })
})

describe('getPrayer', () => {
  it('throws 404 when prayer is out of scope / missing', async () => {
    vi.mocked(GET_PRAYER).mockResolvedValue(null as never)
    await expect(getPrayer({ churchIds: scope, prayerId: PRAYER_ID })).rejects.toMatchObject({
      code: 404,
    })
  })
})

describe('createPrayer', () => {
  it('creates prayer + initial version (atomic) when pastor+language valid', async () => {
    vi.mocked(GET_CHURCH_PASTOR).mockResolvedValue({ id: PASTOR_ID } as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']))
    vi.mocked(CREATE_PRAYER_WITH_VERSION).mockResolvedValue(prayerOut as never)
    const res = await createPrayer({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      input,
      requestId: 'r',
    })
    expect(res).toEqual(prayerOut)
    expect(CREATE_PRAYER_WITH_VERSION).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'c1',
        data: expect.objectContaining({ title: 'My Prayer' }),
      }),
    )
  })

  it('throws 403 for an out-of-scope church', async () => {
    await expect(
      createPrayer({ userId: 'u1', churchId: 'c9', churchIds: scope, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('throws 422 when pastor is not assigned to the church', async () => {
    vi.mocked(GET_CHURCH_PASTOR).mockResolvedValue(null as never)
    await expect(
      createPrayer({ userId: 'u1', churchId: 'c1', churchIds: scope, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'UNKNOWN_PASTOR' })
  })

  it('throws 422 when language is unknown/disabled', async () => {
    vi.mocked(GET_CHURCH_PASTOR).mockResolvedValue({ id: PASTOR_ID } as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set())
    await expect(
      createPrayer({ userId: 'u1', churchId: 'c1', churchIds: scope, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'UNKNOWN_LANGUAGE' })
  })
})

describe('patchPrayer', () => {
  it('creates a NEW snapshot and does not mutate the approved one', async () => {
    vi.mocked(GET_PRAYER).mockResolvedValue({
      ...prayerOut,
      version: 3,
      current: { id: VERSION_ID, approved_at: 'x' },
    } as never)
    vi.mocked(GET_CHURCH_PASTOR).mockResolvedValue({ id: PASTOR_ID } as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']))
    vi.mocked(CREATE_VERSION_SNAPSHOT).mockResolvedValue(prayerOut as never)
    await patchPrayer({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      input: { ...input, version: 3 },
      requestId: 'r',
    })
    expect(CREATE_VERSION_SNAPSHOT).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3 }),
    )
  })

  it('throws 409 on stale version', async () => {
    vi.mocked(GET_PRAYER).mockResolvedValue({ ...prayerOut, version: 9 } as never)
    await expect(
      patchPrayer({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input: { ...input, version: 3 },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })

  it('throws 422 when version is missing', async () => {
    await expect(
      patchPrayer({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422 })
  })

  it('throws 403 for an out-of-scope church', async () => {
    await expect(
      patchPrayer({
        userId: 'u1',
        churchId: 'c9',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input: { ...input, version: 3 },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403 })
  })
})

describe('approveText', () => {
  const action = { version: 3, prayerVersionId: VERSION_ID }

  it('approves the current snapshot', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(ctx as never)
    vi.mocked(APPROVE_TEXT).mockResolvedValue({ id: VERSION_ID } as never)
    const res = await approveText({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      input: action,
      requestId: 'r',
    })
    expect(APPROVE_TEXT).toHaveBeenCalledWith(
      expect.objectContaining({ prayerVersionId: VERSION_ID }),
    )
    expect(res).toEqual({ id: VERSION_ID })
  })

  it('throws 409 WRONG_SNAPSHOT when not the current version', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue({
      ...ctx,
      prayer: { ...ctx.prayer, current_version_id: 'other' },
    } as never)
    await expect(
      approveText({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
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
      approveText({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input: action,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })
})

describe('schedulePrayer', () => {
  const sched = { version: 3, prayerVersionId: VERSION_ID, scheduledAt: '2026-10-01T10:00:00Z' }

  it('schedules when the current version is approved', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(ctx as never)
    vi.mocked(SCHEDULE_PRAYER).mockResolvedValue(prayerOut as never)
    await schedulePrayer({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      input: sched,
      requestId: 'r',
    })
    expect(SCHEDULE_PRAYER).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3, scheduledAt: new Date(sched.scheduledAt) }),
    )
  })

  it('throws 409 when current text is NOT approved', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue({
      ...ctx,
      version: { ...ctx.version, approved_at: null },
    } as never)
    await expect(
      schedulePrayer({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input: sched,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'PRAYER_NOT_APPROVED' })
  })
})

describe('publishPrayer', () => {
  const action = { version: 3, prayerVersionId: VERSION_ID }

  it('publishes text-only (audio optional) via idempotency when current is approved', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue(ctx as never)
    vi.mocked(withIdempotency).mockResolvedValue({ fresh: true, resource_id: PRAYER_ID } as never)
    vi.mocked(GET_PRAYER).mockResolvedValue(prayerOut as never)
    const res = await publishPrayer({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      prayerId: PRAYER_ID,
      input: action,
      idempotencyKey: 'k1',
      requestId: 'r',
    })
    expect(res).toEqual(prayerOut)
    expect(withIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'prayer.publish', key: 'k1' }),
    )
  })

  it('throws 409 when the current text is not approved (unapproved cannot publish)', async () => {
    vi.mocked(GET_VERSION).mockResolvedValue({
      ...ctx,
      version: { ...ctx.version, approved_at: null },
    } as never)
    await expect(
      publishPrayer({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        prayerId: PRAYER_ID,
        input: action,
        idempotencyKey: 'k1',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'PRAYER_NOT_APPROVED' })
    expect(withIdempotency).not.toHaveBeenCalled()
  })
})
