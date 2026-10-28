// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processMailSendJob, runMailSendTick } from './mail-send-job'
import { GeneralError } from '@/utils/general-error'

const mocks = vi.hoisted(() => ({
  outbox: {
    GET_JOB: vi.fn(),
    MARK_JOB_STATE: vi.fn(),
    CLAIM_PENDING_JOBS: vi.fn(),
  },
  sendMail: vi.fn(),
}))

vi.mock('@/providers/outbox-job', () => ({
  GET_JOB: mocks.outbox.GET_JOB,
  MARK_JOB_STATE: mocks.outbox.MARK_JOB_STATE,
  CLAIM_PENDING_JOBS: mocks.outbox.CLAIM_PENDING_JOBS,
}))

vi.mock('@/controller/mail', () => ({
  default: mocks.sendMail,
}))

type MockJob = {
  id: string
  kind: string
  state: string
  attempts: number
  payload: unknown
}

const validPayload = {
  from: 'noreply@example.com',
  to: 'user@example.com',
  subject: 'Test Subject',
  template_name: 'verify-email',
  payload: { link: 'https://example.com' },
  baseUrl: 'https://example.com',
}

let jobs: Map<string, MockJob>

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.MAIL_RATE_LIMIT_MS
  jobs = new Map()

  mocks.outbox.GET_JOB.mockImplementation(
    async ({ jobId }: { jobId: string }) => jobs.get(jobId) ?? null,
  )

  mocks.outbox.MARK_JOB_STATE.mockImplementation(
    async ({
      jobId,
      state,
    }: {
      jobId: string
      state: string
      errorCode?: string
      availableAt?: Date
    }) => {
      const job = jobs.get(jobId)
      if (job) {
        job.state = state
      }
      return job
    },
  )

  mocks.outbox.CLAIM_PENDING_JOBS.mockImplementation(
    async ({ kind, limit }: { kind: string; limit: number }) => {
      const claimed: Array<{ id: string; attempts: number; resource_id: null; payload: unknown }> =
        []
      for (const job of Array.from(jobs.values())) {
        if (job.kind === kind && job.state === 'PENDING') {
          job.state = 'RUNNING'
          claimed.push({
            id: job.id,
            attempts: job.attempts,
            resource_id: null,
            payload: job.payload,
          })
          if (claimed.length >= limit) break
        }
      }
      return claimed
    },
  )

  mocks.sendMail.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.MAIL_RATE_LIMIT_MS
})

describe('processMailSendJob', () => {
  describe('skip path', () => {
    it('returns skipped when the job does not exist', async () => {
      const outcome = await processMailSendJob('missing-id', 'req-1')
      expect(outcome).toBe('skipped')
      expect(mocks.sendMail).not.toHaveBeenCalled()
    })

    it('returns skipped when the job state is not RUNNING', async () => {
      jobs.set('j-pending', {
        id: 'j-pending',
        kind: 'mail.send',
        state: 'PENDING',
        attempts: 0,
        payload: validPayload,
      })

      const outcome = await processMailSendJob('j-pending', 'req-1')
      expect(outcome).toBe('skipped')
      expect(mocks.sendMail).not.toHaveBeenCalled()
    })
  })

  describe('rate limit', () => {
    it('sends immediately when MAIL_RATE_LIMIT_MS is unset', async () => {
      jobs.set('j-instant', {
        id: 'j-instant',
        kind: 'mail.send',
        state: 'RUNNING',
        attempts: 0,
        payload: validPayload,
      })

      const outcome = await processMailSendJob('j-instant', 'req-1')
      expect(outcome).toBe('succeeded')
      expect(mocks.sendMail).toHaveBeenCalledTimes(1)
      expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'j-instant', state: 'SUCCEEDED' }),
      )
    })

    it('delays delivery by MAIL_RATE_LIMIT_MS when set', async () => {
      vi.useFakeTimers()
      process.env.MAIL_RATE_LIMIT_MS = '250'

      jobs.set('j-delayed', {
        id: 'j-delayed',
        kind: 'mail.send',
        state: 'RUNNING',
        attempts: 0,
        payload: validPayload,
      })

      const promise = processMailSendJob('j-delayed', 'req-1')

      // Before advancing timers, sendMail and MARK_JOB_STATE must not have been reached
      await Promise.resolve()
      expect(mocks.sendMail).not.toHaveBeenCalled()
      expect(mocks.outbox.MARK_JOB_STATE).not.toHaveBeenCalled()

      // Advance by 250ms
      await vi.advanceTimersByTimeAsync(250)

      const outcome = await promise
      expect(outcome).toBe('succeeded')
      expect(mocks.sendMail).toHaveBeenCalledTimes(1)
      expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'j-delayed', state: 'SUCCEEDED' }),
      )
    })
  })

  describe('permanent fail', () => {
    it('fails with MISSING_PAYLOAD when payload is missing or malformed', async () => {
      jobs.set('j-bad', {
        id: 'j-bad',
        kind: 'mail.send',
        state: 'RUNNING',
        attempts: 0,
        payload: { from: 'a@example.com' }, // missing to, subject, template_name, payload
      })

      const outcome = await processMailSendJob('j-bad', 'req-1')
      expect(outcome).toBe('failed')
      expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'j-bad', state: 'FAILED', errorCode: 'MISSING_PAYLOAD' }),
      )
      expect(mocks.sendMail).not.toHaveBeenCalled()
    })

    it('fails permanently with NOT_FOUND when sendMail throws 404 template missing', async () => {
      jobs.set('j-no-template', {
        id: 'j-no-template',
        kind: 'mail.send',
        state: 'RUNNING',
        attempts: 0,
        payload: validPayload,
      })

      mocks.sendMail.mockRejectedValueOnce(
        new GeneralError({
          code: 404,
          error_code: 'NOT_FOUND',
          error: 'template file not found',
          details: 'Template file not found!',
        }),
      )

      const outcome = await processMailSendJob('j-no-template', 'req-1')
      expect(outcome).toBe('failed')
      expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'j-no-template',
          state: 'FAILED',
          errorCode: 'NOT_FOUND',
        }),
      )
    })
  })

  describe('requeue', () => {
    it('requeues with backoff when generic error occurs and attempts < 3', async () => {
      jobs.set('j-retry', {
        id: 'j-retry',
        kind: 'mail.send',
        state: 'RUNNING',
        attempts: 1,
        payload: validPayload,
      })

      mocks.sendMail.mockRejectedValueOnce(new Error('SMTP timeout'))

      const outcome = await processMailSendJob('j-retry', 'req-1')
      expect(outcome).toBe('requeued')
      expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'j-retry',
          state: 'PENDING',
          errorCode: 'INTERNAL_JOB_ERROR',
          availableAt: expect.any(Date),
        }),
      )
    })

    it('fails when generic error occurs and attempts >= 3', async () => {
      jobs.set('j-maxed', {
        id: 'j-maxed',
        kind: 'mail.send',
        state: 'RUNNING',
        attempts: 3,
        payload: validPayload,
      })

      mocks.sendMail.mockRejectedValueOnce(new Error('SMTP connection refused'))

      const outcome = await processMailSendJob('j-maxed', 'req-1')
      expect(outcome).toBe('failed')
      expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'j-maxed',
          state: 'FAILED',
          errorCode: 'INTERNAL_JOB_ERROR',
        }),
      )
    })
  })
})

describe('runMailSendTick', () => {
  it('counts claimed and succeeded jobs', async () => {
    jobs.set('j-1', {
      id: 'j-1',
      kind: 'mail.send',
      state: 'PENDING',
      attempts: 0,
      payload: validPayload,
    })
    jobs.set('j-2', {
      id: 'j-2',
      kind: 'mail.send',
      state: 'PENDING',
      attempts: 0,
      payload: validPayload,
    })

    const summary = await runMailSendTick({ limit: 10 })
    expect(summary).toEqual({
      claimed: 2,
      succeeded: 2,
      failed: 0,
      requeued: 0,
      skipped: 0,
    })
  })

  it('catches unexpected processor throws and counts them as skipped with backoff reset', async () => {
    jobs.set('j-throw', {
      id: 'j-throw',
      kind: 'mail.send',
      state: 'PENDING',
      attempts: 0,
      payload: validPayload,
    })

    // Mock GET_JOB to throw an unexpected error when processing this job
    mocks.outbox.GET_JOB.mockRejectedValueOnce(new Error('DB disconnect'))

    const summary = await runMailSendTick({ limit: 10 })
    expect(summary).toEqual({
      claimed: 1,
      succeeded: 0,
      failed: 0,
      requeued: 0,
      skipped: 1,
    })
    expect(mocks.outbox.MARK_JOB_STATE).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'j-throw',
        state: 'PENDING',
        errorCode: 'INTERNAL_JOB_ERROR',
        availableAt: expect.any(Date),
      }),
    )
  })
})
