// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const auditCalls: { action: string; resourceId: string }[] = []
  const dbTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      auditLog: {
        create: async (args: { data: { action: string; resource_id: string } }) => {
          auditCalls.push({ action: args.data.action, resourceId: args.data.resource_id })
          return args.data
        },
      },
    }),
  )
  return { auditCalls, dbTransaction }
})

vi.mock('@/utils/db-transaction', () => ({ dbTransaction: mocks.dbTransaction }))

vi.mock('@/providers/notification', () => ({
  GET_NOTIFICATION_RULES: vi.fn(),
  GET_NOTIFICATION_RULE_BY_TYPE: vi.fn(),
  UPSERT_NOTIFICATION_RULE: vi.fn(),
}))

import { listNotificationRules, updateNotificationRules } from './notification'
import {
  GET_NOTIFICATION_RULE_BY_TYPE,
  GET_NOTIFICATION_RULES,
  UPSERT_NOTIFICATION_RULE,
} from '@/providers/notification'
import { NotificationRulesUpdateSchema } from '@/models/notification'
import { ALLOWED_RULE_TYPES } from '@/models/notification'

describe('notification-rules validation contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auditCalls.length = 0
  })

  it('rejects a disallowed rule type (422 contract)', () => {
    const parsed = NotificationRulesUpdateSchema.safeParse([
      { type: 'marketing_push', version: 1, enabled: true },
    ])
    expect(parsed.success).toBe(false)
  })

  it('rejects an offset outside the allowlist (422 contract)', () => {
    const parsed = NotificationRulesUpdateSchema.safeParse([
      { type: 'donation_reminder', version: 1, offset_minutes: 45 },
    ])
    expect(parsed.success).toBe(false)
  })

  it('exposes the ALLOWED_RULE_TYPES const', () => {
    expect(ALLOWED_RULE_TYPES).toEqual([
      'donation_reminder',
      'prayer_published',
      'event_reminder',
      'announcement_published',
    ])
  })

  it('accepts a channel-only update without enabling or offset', () => {
    const parsed = NotificationRulesUpdateSchema.safeParse([
      { type: 'prayer_published', version: 1, email_enabled: true },
    ])
    expect(parsed.success).toBe(true)
  })

  it('accepts the monthly recurrence for donation reminders only', () => {
    expect(
      NotificationRulesUpdateSchema.safeParse([
        { type: 'donation_reminder', version: 1, recurrence: 'monthly' },
      ]).success,
    ).toBe(true)
    expect(
      NotificationRulesUpdateSchema.safeParse([
        { type: 'donation_reminder', version: 1, recurrence: null },
      ]).success,
    ).toBe(true)
    expect(
      NotificationRulesUpdateSchema.safeParse([
        { type: 'event_reminder', version: 1, recurrence: 'weekly' },
      ]).success,
    ).toBe(false)
  })

  it('rejects an unknown recurrence', () => {
    expect(
      NotificationRulesUpdateSchema.safeParse([
        { type: 'donation_reminder', version: 1, recurrence: 'daily' },
      ]).success,
    ).toBe(false)
  })

  it('accepts an allowlisted offset of null or 1440', () => {
    expect(
      NotificationRulesUpdateSchema.safeParse([
        { type: 'event_reminder', version: 1, enabled: false, offset_minutes: 1440 },
      ]).success,
    ).toBe(true)
    expect(
      NotificationRulesUpdateSchema.safeParse([
        { type: 'event_reminder', version: 1, offset_minutes: null },
      ]).success,
    ).toBe(true)
  })
})

describe('listNotificationRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auditCalls.length = 0
  })

  it('returns only rules whose type is in the allowlist', async () => {
    vi.mocked(GET_NOTIFICATION_RULES).mockResolvedValue([
      { id: 'r1', type: 'donation_reminder', enabled: true, offset_minutes: null, version: 1 },
      { id: 'r2', type: 'daily_prayer', enabled: true, offset_minutes: null, version: 1 },
      { id: 'r3', type: 'prayer_published', enabled: false, offset_minutes: 60, version: 2 },
    ] as never)

    const out = await listNotificationRules()
    expect(out.map((r) => r.type)).toEqual(['donation_reminder', 'prayer_published'])
  })
})

describe('updateNotificationRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auditCalls.length = 0
  })

  it('returns 409 (STALE_VERSION) when a rule version does not match', async () => {
    vi.mocked(GET_NOTIFICATION_RULE_BY_TYPE).mockResolvedValue({
      type: 'donation_reminder',
      version: 2,
    } as never)

    await expect(
      updateNotificationRules({
        items: [{ type: 'donation_reminder', version: 1, enabled: true }],
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })

    expect(UPSERT_NOTIFICATION_RULE).not.toHaveBeenCalled()
    expect(mocks.auditCalls).toHaveLength(0)
  })

  it('upserts, increments version and audits each change', async () => {
    vi.mocked(GET_NOTIFICATION_RULE_BY_TYPE).mockResolvedValue({
      type: 'donation_reminder',
      version: 1,
    } as never)
    vi.mocked(UPSERT_NOTIFICATION_RULE).mockResolvedValue({
      id: 'r1',
      type: 'donation_reminder',
      enabled: true,
      offset_minutes: null,
      version: 2,
    } as never)

    const out = await updateNotificationRules({
      items: [{ type: 'donation_reminder', version: 1, enabled: true }],
      actorId: 'actor',
      requestId: 'r',
    })

    expect(UPSERT_NOTIFICATION_RULE).toHaveBeenCalledWith(
      { type: 'donation_reminder', payload: { enabled: true } },
      expect.anything(),
    )
    expect(out[0]).toMatchObject({ type: 'donation_reminder', version: 2 })
    expect(mocks.auditCalls).toEqual([
      { action: 'notification_rule.update', resourceId: 'donation_reminder' },
    ])
  })

  it('creates a missing allowed rule and audits it', async () => {
    vi.mocked(GET_NOTIFICATION_RULE_BY_TYPE).mockResolvedValue(null as never)
    vi.mocked(UPSERT_NOTIFICATION_RULE).mockResolvedValue({
      id: 'r2',
      type: 'prayer_published',
      enabled: false,
      offset_minutes: 1440,
      version: 1,
    } as never)

    const out = await updateNotificationRules({
      items: [{ type: 'prayer_published', version: 1, enabled: false, offset_minutes: 1440 }],
      actorId: 'actor',
      requestId: 'r',
    })
    expect(out[0]).toMatchObject({ type: 'prayer_published', version: 1 })
    expect(UPSERT_NOTIFICATION_RULE).toHaveBeenCalled()
    expect(mocks.auditCalls).toHaveLength(1)
  })
})
