// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'

const { db, auditPayloadMock } = vi.hoisted(() => {
  const dbMock = {
    prayer: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    prayerVersion: {
      findUnique: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
    },
    outboxJob: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
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

import {
  GET_PRAYER_FOR_PUBLISH_JOB,
  GET_VERSION_APPROVAL,
  CREATE_PRAYER_WITH_VERSION,
  CREATE_VERSION_SNAPSHOT,
  PUBLISH_PRAYER_BY_JOB,
  SCAN_DUE_SCHEDULED_PRAYERS,
  ENQUEUE_DUE_PRAYER_PUBLISH,
  APPROVE_TEXT,
  LIST_PRAYERS,
} from './prayer'

beforeEach(() => {
  vi.resetAllMocks()
})
describe('LIST_PRAYERS', () => {
  it('filters by archive status (published and past date)', async () => {
    db.$transaction.mockResolvedValueOnce([1, []])
    await LIST_PRAYERS({
      churchIds: new Set(['ch1']),
      query: {
        page: 1,
        limit: 10,
        order_by: 'published_at',
        order_direction: 'desc',
        status: 'archive',
      },
    })
    expect(db.prayer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          church_id: { in: ['ch1'] },
          published_at: { not: null, lte: expect.any(Date) },
        }),
      }),
    )
  })

  it('filters by current status (unpublished or future date)', async () => {
    db.$transaction.mockResolvedValueOnce([1, []])
    await LIST_PRAYERS({
      churchIds: new Set(['ch1']),
      query: {
        page: 1,
        limit: 10,
        order_by: 'created_at',
        order_direction: 'desc',
        status: 'current',
      },
    })
    expect(db.prayer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          church_id: { in: ['ch1'] },
          OR: [{ published_at: null }, { published_at: { gt: expect.any(Date) } }],
        }),
      }),
    )
  })
})

describe('CREATE_PRAYER_WITH_VERSION', () => {
  it('creates a stable title slug with the prayer and initial version', async () => {
    const createdAt = new Date('2026-10-23T00:00:00.000Z')
    db.prayer.findUnique.mockResolvedValueOnce(null)
    db.prayer.create.mockResolvedValueOnce({
      id: 'p1',
      slug: 'ohtu-rahu',
      church_id: 'c1',
      created_by: 'u1',
      version: 1,
      created_at: createdAt,
      current_version_id: null,
      published_version_id: null,
      scheduled_version_id: null,
      scheduled_at: null,
      published_at: null,
    })
    db.prayerVersion.create.mockResolvedValueOnce({
      id: 'v1',
      prayer_id: 'p1',
      version_number: 1,
      pastor_id: 'pastor-1',
      title: 'Õhtu rahu',
      introduction: null,
      body: 'Amen.',
      language_code: 'et',
      text_hash: 'hash',
      approved_by: null,
      approved_at: null,
      selected_audio_id: null,
      created_at: createdAt,
    })
    db.prayer.update.mockResolvedValueOnce({
      id: 'p1',
      slug: 'ohtu-rahu',
      church_id: 'c1',
      version: 1,
      created_at: createdAt,
      current_version_id: 'v1',
      published_version_id: null,
      scheduled_version_id: null,
      scheduled_at: null,
      published_at: null,
    })

    await CREATE_PRAYER_WITH_VERSION({
      churchId: 'c1',
      data: {
        pastorId: 'pastor-1',
        title: 'Õhtu rahu',
        introduction: null,
        body: 'Amen.',
        languageCode: 'et',
      },
      actorId: 'u1',
      requestId: 'request-1',
    })

    expect(db.prayer.create).toHaveBeenCalledWith({
      data: { slug: 'ohtu-rahu', church_id: 'c1', created_by: 'u1' },
    })
  })

  it('adds a non-ID suffix when a title slug already exists', async () => {
    db.prayer.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null)
    db.prayer.create.mockResolvedValueOnce({ id: 'p2' })
    db.prayerVersion.create.mockResolvedValueOnce({
      id: 'v2',
      version_number: 1,
      pastor_id: 'pastor-1',
      title: 'Morning Prayer',
      introduction: null,
      body: 'Amen.',
      language_code: 'en',
      text_hash: 'hash',
      approved_by: null,
      approved_at: null,
      selected_audio_id: null,
      created_at: new Date(),
    })
    db.prayer.update.mockResolvedValueOnce({
      id: 'p2',
      church_id: 'c1',
      version: 1,
      created_at: new Date(),
      current_version_id: 'v2',
      published_version_id: null,
      scheduled_version_id: null,
      scheduled_at: null,
      published_at: null,
    })

    await CREATE_PRAYER_WITH_VERSION({
      churchId: 'c1',
      data: {
        pastorId: 'pastor-1',
        title: 'Morning Prayer',
        introduction: null,
        body: 'Amen.',
        languageCode: 'en',
      },
      actorId: 'u1',
      requestId: 'request-2',
    })

    expect(db.prayer.create.mock.calls[0][0].data.slug).toMatch(/^morning-prayer-[a-z0-9]{6}$/)
  })
})

describe('GET_PRAYER_FOR_PUBLISH_JOB', () => {
  it('reads fields for the job from prayer and its church', async () => {
    db.prayer.findUnique.mockResolvedValueOnce({ id: 'pr1' })
    await GET_PRAYER_FOR_PUBLISH_JOB({ prayerId: 'pr1' })
    expect(db.prayer.findUnique).toHaveBeenCalledWith({
      where: { id: 'pr1' },
      select: {
        id: true,
        church_id: true,
        version: true,
        published_version_id: true,
        published_at: true,
        scheduled_version_id: true,
        scheduled_at: true,
        church: { select: { id: true, status: true } },
      },
    })
  })
})

describe('GET_VERSION_APPROVAL', () => {
  it('reads approval fields', async () => {
    db.prayerVersion.findUnique.mockResolvedValueOnce({ id: 'v1' })
    await GET_VERSION_APPROVAL({ prayerVersionId: 'v1' })
    expect(db.prayerVersion.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      select: { id: true, approved_at: true },
    })
  })
})

describe('PUBLISH_PRAYER_BY_JOB', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-02T10:00:00.000Z') })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates prayer state, creates audit log, returns count 1', async () => {
    db.prayer.updateMany.mockResolvedValueOnce({ count: 1 })

    const result = await PUBLISH_PRAYER_BY_JOB({
      prayerId: 'pr1',
      prayerVersionId: 'v1',
      churchId: 'c1',
      expectedVersion: 4,
      requestId: 'req',
    })

    expect(result).toEqual({ count: 1 })

    expect(db.prayer.updateMany).toHaveBeenCalledWith({
      where: { id: 'pr1', church_id: 'c1', version: 4 },
      data: {
        version: { increment: 1 },
        published_version_id: 'v1',
        published_at: new Date('2026-10-02T10:00:00.000Z'),
        scheduled_version_id: null,
        scheduled_at: null,
        updated_at: new Date('2026-10-02T10:00:00.000Z'),
      },
    })

    expect(auditPayloadMock).toHaveBeenCalledWith({
      actorId: null,
      churchId: 'c1',
      action: 'prayer.publish.job',
      resourceType: 'prayer',
      resourceId: 'pr1',
      outcome: 'success',
      requestId: 'req',
    })

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ outcome: 'success' }),
    })
  })

  it('detects a lost race via 0 count and does not log audit', async () => {
    db.prayer.updateMany.mockResolvedValueOnce({ count: 0 })
    const result = await PUBLISH_PRAYER_BY_JOB({
      prayerId: 'pr1',
      prayerVersionId: 'v1',
      churchId: 'c1',
      expectedVersion: 4,
      requestId: 'req',
    })
    expect(result).toEqual({ count: 0 })
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })
})

describe('SCAN_DUE_SCHEDULED_PRAYERS', () => {
  it('finds and filters correctly', async () => {
    const now = new Date('2026-10-02T10:00:00.000Z')
    db.prayer.findMany.mockResolvedValueOnce([
      {
        id: '1',
        scheduled_version_id: 'v1',
        published_version_id: 'v0',
        scheduled_at: new Date(now.getTime() - 1000),
      },
      {
        id: '2',
        scheduled_version_id: 'v2',
        published_version_id: 'v2',
        scheduled_at: new Date(now.getTime() - 2000),
      }, // excluded
      {
        id: '3',
        scheduled_version_id: 'v3',
        published_version_id: null,
        scheduled_at: new Date(now.getTime() - 3000),
      },
    ])

    const result = await SCAN_DUE_SCHEDULED_PRAYERS({ now, limit: 10 })

    expect(db.prayer.findMany).toHaveBeenCalledWith({
      where: {
        scheduled_at: { lte: now },
        scheduled_version_id: { not: null },
      },
      take: 10,
      orderBy: { scheduled_at: 'asc' },
      select: {
        id: true,
        church_id: true,
        scheduled_version_id: true,
        published_version_id: true,
        scheduled_at: true,
      },
    })

    expect(result).toEqual([
      { id: '1', scheduled_version_id: 'v1', scheduled_at: new Date(now.getTime() - 1000) },
      { id: '3', scheduled_version_id: 'v3', scheduled_at: new Date(now.getTime() - 3000) },
    ])
  })
})

describe('ENQUEUE_DUE_PRAYER_PUBLISH', () => {
  it('upserts outbox row', async () => {
    db.outboxJob.upsert.mockResolvedValueOnce({ id: 'oj1' })
    const at = new Date()

    await ENQUEUE_DUE_PRAYER_PUBLISH({
      prayerId: 'pr1',
      prayerVersionId: 'v1',
      churchId: 'c1',
      availableAt: at,
    })

    expect(db.outboxJob.upsert).toHaveBeenCalledWith({
      where: { dedupe_key: 'prayer.publish:pr1:v1' },
      create: {
        kind: 'prayer.publish',
        dedupe_key: 'prayer.publish:pr1:v1',
        resource_id: 'pr1',
        payload: { prayerVersionId: 'v1', churchId: 'c1' },
        available_at: at,
      },
      update: {},
    })
  })

  it('revives a terminal job so a re-scheduled publish can fire again', async () => {
    db.outboxJob.upsert.mockResolvedValueOnce({ id: 'oj1' })
    const at = new Date()

    await ENQUEUE_DUE_PRAYER_PUBLISH({
      prayerId: 'pr1',
      prayerVersionId: 'v1',
      churchId: 'c1',
      availableAt: at,
    })

    expect(db.outboxJob.updateMany).toHaveBeenCalledWith({
      where: {
        dedupe_key: 'prayer.publish:pr1:v1',
        state: { in: ['SUCCEEDED', 'FAILED'] },
      },
      data: {
        state: 'PENDING',
        attempts: 0,
        available_at: at,
        last_error_code: null,
        lease_until: null,
      },
    })
  })
})

describe('CREATE_VERSION_SNAPSHOT', () => {
  it('does not inherit selected_audio_id or approved_at from previous version (PR-09 Rule 1)', async () => {
    db.prayer.updateMany.mockResolvedValueOnce({ count: 1 })
    db.prayer.create.mockResolvedValueOnce({ id: 'pr1' })
    db.prayer.update.mockResolvedValueOnce({
      id: 'pr1',
      current_version_id: 'v2',
      version: 2,
      created_at: new Date(),
    })
    db.prayerVersion.aggregate.mockResolvedValueOnce({ _max: { version_number: 1 } })
    db.prayerVersion.create.mockResolvedValueOnce({ id: 'v2', created_at: new Date() })

    await CREATE_VERSION_SNAPSHOT({
      churchIds: new Set(['c1']),
      prayerId: 'pr1',
      expectedVersion: 1,
      data: {
        pastorId: 'pastor1',
        title: 'Title',
        introduction: null,
        body: 'Body',
        languageCode: 'en',
      },
      actorId: 'u1',
      requestId: 'req1',
    })

    // Ensure create is called with clean state for audio / approval
    expect(db.prayerVersion.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
        selected_audio_id: expect.anything(),
        approved_at: expect.anything(),
      }),
    })

    // specifically check what it IS called with to ensure we aren't passing null implicitly if prisma schema changes
    const createCall = db.prayerVersion.create.mock.calls[0][0].data
    expect(createCall).not.toHaveProperty('selected_audio_id')
    expect(createCall).not.toHaveProperty('approved_at')
  })
})

describe('APPROVE_TEXT', () => {
  it('throws stale if the prayer version increment race fails', async () => {
    db.prayer.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      APPROVE_TEXT({
        churchIds: new Set(['c1']),
        prayerId: 'pr1',
        expectedVersion: 3,
        prayerVersionId: 'v1',
        actorId: 'u1',
        requestId: 'req1',
      }),
    ).rejects.toMatchObject({
      code: 409,
      error_code: 'STALE_VERSION',
    })
  })

  it('throws stale if exact targeting by prayerVersionId fails (P2025)', async () => {
    db.prayer.updateMany.mockResolvedValueOnce({ count: 1 })
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    db.prayerVersion.update.mockRejectedValueOnce(p2025)

    await expect(
      APPROVE_TEXT({
        churchIds: new Set(['c1']),
        prayerId: 'pr1',
        expectedVersion: 3,
        prayerVersionId: 'v1',
        actorId: 'u1',
        requestId: 'req1',
      }),
    ).rejects.toMatchObject({
      code: 409,
      error_code: 'STALE_VERSION',
    })
  })
})
