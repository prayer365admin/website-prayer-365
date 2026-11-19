// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  GET_JOB: vi.fn(),
  MARK_JOB_STATE: vi.fn(),
  CLAIM_PENDING_JOBS: vi.fn(),
  GET_PRIVACY_JOB: vi.fn(),
  SET_PRIVACY_JOB_STATE: vi.fn(),
  CLAIM_PRIVACY_JOB: vi.fn(),
  GET_ERASURE_CONTEXT: vi.fn(),
  MARK_SUBSCRIPTION_CANCELED: vi.fn(),
  SOFT_DELETE_USER: vi.fn(),
  cancelSubscription: vi.fn(),
  isStripeEnabled: vi.fn(),
}))

vi.mock('@/providers/outbox-job', () => ({
  GET_JOB: m.GET_JOB,
  MARK_JOB_STATE: m.MARK_JOB_STATE,
  CLAIM_PENDING_JOBS: m.CLAIM_PENDING_JOBS,
}))
vi.mock('@/providers/privacy-delete', () => ({
  GET_PRIVACY_JOB: m.GET_PRIVACY_JOB,
  SET_PRIVACY_JOB_STATE: m.SET_PRIVACY_JOB_STATE,
  CLAIM_PRIVACY_JOB: m.CLAIM_PRIVACY_JOB,
  GET_ERASURE_CONTEXT: m.GET_ERASURE_CONTEXT,
  MARK_SUBSCRIPTION_CANCELED: m.MARK_SUBSCRIPTION_CANCELED,
  SOFT_DELETE_USER: m.SOFT_DELETE_USER,
}))
vi.mock('@/providers/stripe', () => ({
  STRIPE: { cancelSubscription: m.cancelSubscription },
  isStripeEnabled: m.isStripeEnabled,
}))

import { processPrivacyDeleteJob, runPrivacyDeleteTick } from './privacy-delete-job'

const past = new Date(Date.now() - 60_000)
const ctx = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  status: 'deletion_pending',
  donationSubscriptions: [],
  ...over,
})

describe('processPrivacyDeleteJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.GET_JOB.mockResolvedValue({ id: 'o1', state: 'RUNNING', attempts: 1, resource_id: 'j1' })
    m.GET_PRIVACY_JOB.mockResolvedValue({
      id: 'j1',
      user_id: 'u1',
      state: 'ACCEPTED',
      grace_ends_at: past,
    })
    m.GET_ERASURE_CONTEXT.mockResolvedValue(ctx())
    m.isStripeEnabled.mockReturnValue(true)
    m.cancelSubscription.mockResolvedValue({})
    m.SOFT_DELETE_USER.mockResolvedValue(undefined)
    m.CLAIM_PRIVACY_JOB.mockResolvedValue(true)
  })

  it('after grace: claims the job, soft-deletes the user, succeeds', async () => {
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('succeeded')
    expect(m.CLAIM_PRIVACY_JOB).toHaveBeenCalledWith({ id: 'j1' })
    // Only the user + job + request id: nothing else is touched, so related data stays intact.
    expect(m.SOFT_DELETE_USER).toHaveBeenCalledWith({ userId: 'u1', jobId: 'j1', requestId: 'r1' })
    expect(m.MARK_JOB_STATE).toHaveBeenCalledWith({ jobId: 'o1', state: 'SUCCEEDED' })
  })

  it('cancels Stripe subscriptions BEFORE the soft delete', async () => {
    m.GET_ERASURE_CONTEXT.mockResolvedValue(
      ctx({ donationSubscriptions: [{ provider_subscription_id: 'sub_1' }] }),
    )
    const order: string[] = []
    m.cancelSubscription.mockImplementation(async () => order.push('stripe'))
    m.SOFT_DELETE_USER.mockImplementation(async () => order.push('soft-delete'))
    await processPrivacyDeleteJob('o1', 'r1')
    expect(order).toEqual(['stripe', 'soft-delete'])
    expect(m.MARK_SUBSCRIPTION_CANCELED).toHaveBeenCalledWith({ providerSubscriptionId: 'sub_1' })
  })

  it('an already-canceled Stripe subscription is not an error', async () => {
    m.GET_ERASURE_CONTEXT.mockResolvedValue(
      ctx({ donationSubscriptions: [{ provider_subscription_id: 'sub_1' }] }),
    )
    m.cancelSubscription.mockRejectedValue({ code: 'resource_missing' })
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('succeeded')
  })

  it('a Stripe failure re-queues and soft-deletes NOTHING', async () => {
    m.GET_ERASURE_CONTEXT.mockResolvedValue(
      ctx({ donationSubscriptions: [{ provider_subscription_id: 'sub_1' }] }),
    )
    m.cancelSubscription.mockRejectedValue(new Error('stripe down'))
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('requeued')
    expect(m.SOFT_DELETE_USER).not.toHaveBeenCalled()
    expect(m.MARK_JOB_STATE).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'o1', state: 'PENDING' }),
    )
  })

  it('active subscription + Stripe disabled: refuses to soft-delete', async () => {
    m.isStripeEnabled.mockReturnValue(false)
    m.GET_ERASURE_CONTEXT.mockResolvedValue(
      ctx({ donationSubscriptions: [{ provider_subscription_id: 'sub_1' }] }),
    )
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('requeued')
    expect(m.SOFT_DELETE_USER).not.toHaveBeenCalled()
  })

  it('gives up after the last attempt: both jobs FAILED', async () => {
    m.GET_JOB.mockResolvedValue({ id: 'o1', state: 'RUNNING', attempts: 5, resource_id: 'j1' })
    m.SOFT_DELETE_USER.mockRejectedValue(new Error('db down'))
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('failed')
    expect(m.SET_PRIVACY_JOB_STATE).toHaveBeenCalledWith({ id: 'j1', state: 'FAILED' })
    expect(m.MARK_JOB_STATE).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'o1', state: 'FAILED' }),
    )
  })

  it('a duplicate delivery (outbox not RUNNING) is skipped untouched', async () => {
    m.GET_JOB.mockResolvedValue({ id: 'o1', state: 'SUCCEEDED', attempts: 1, resource_id: 'j1' })
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('skipped')
    expect(m.SOFT_DELETE_USER).not.toHaveBeenCalled()
  })

  it.each(['COMPLETED', 'CANCELLED'])('a %s privacy job is a no-op', async (state) => {
    m.GET_PRIVACY_JOB.mockResolvedValue({ id: 'j1', user_id: 'u1', state, grace_ends_at: past })
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('skipped')
    expect(m.SOFT_DELETE_USER).not.toHaveBeenCalled()
  })

  it('before the end of grace: re-queued for grace_ends_at, nothing deleted', async () => {
    const future = new Date(Date.now() + 3600_000)
    m.GET_PRIVACY_JOB.mockResolvedValue({
      id: 'j1',
      user_id: 'u1',
      state: 'ACCEPTED',
      grace_ends_at: future,
    })
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('requeued')
    expect(m.MARK_JOB_STATE).toHaveBeenCalledWith({
      jobId: 'o1',
      state: 'PENDING',
      availableAt: future,
    })
    expect(m.SOFT_DELETE_USER).not.toHaveBeenCalled()
  })

  it('NEVER soft-deletes an account that is no longer pending deletion (user came back)', async () => {
    m.GET_ERASURE_CONTEXT.mockResolvedValue(ctx({ status: 'active' }))
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('skipped')
    expect(m.SET_PRIVACY_JOB_STATE).toHaveBeenCalledWith({ id: 'j1', state: 'CANCELLED' })
    expect(m.SOFT_DELETE_USER).not.toHaveBeenCalled()
  })

  it('the user cancelled between the check and the claim: nothing is touched, nothing deleted', async () => {
    m.GET_ERASURE_CONTEXT.mockResolvedValue(
      ctx({ donationSubscriptions: [{ provider_subscription_id: 'sub_1' }] }),
    )
    m.CLAIM_PRIVACY_JOB.mockResolvedValue(false)
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('skipped')
    expect(m.cancelSubscription).not.toHaveBeenCalled()
    expect(m.SOFT_DELETE_USER).not.toHaveBeenCalled()
  })

  it('missing privacy job row: FAILED, not a retry loop', async () => {
    m.GET_PRIVACY_JOB.mockResolvedValue(null)
    await expect(processPrivacyDeleteJob('o1', 'r1')).resolves.toBe('failed')
  })
})

describe('runPrivacyDeleteTick', () => {
  it('claims the privacy.delete kind and tallies outcomes', async () => {
    vi.clearAllMocks()
    m.CLAIM_PENDING_JOBS.mockResolvedValue([{ id: 'o1' }])
    m.GET_JOB.mockResolvedValue(null)
    const summary = await runPrivacyDeleteTick()
    expect(m.CLAIM_PENDING_JOBS).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'privacy.delete' }),
    )
    expect(summary).toMatchObject({ claimed: 1, skipped: 1 })
  })
})
