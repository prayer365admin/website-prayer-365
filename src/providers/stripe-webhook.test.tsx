import { expect, test, describe, beforeEach, afterEach, vi, Mock } from 'vitest'
import {
  verifyStripeWebhookSignature,
  parseStripeWebhookEvent,
  RECORD_STRIPE_WEBHOOK_RECEIPT,
} from './stripe-webhook'
import { GeneralError } from '@/utils/general-error'
import { db } from '@/utils/db-connection'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'

describe('verifyStripeWebhookSignature', () => {
  const secret = 'whsec_test_secret'
  const rawBody = '{"id":"evt_test","type":"payment_intent.succeeded"}'
  let timestamp: number

  beforeEach(() => {
    timestamp = Math.floor(Date.now() / 1000)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(timestamp * 1000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const generateSignature = (ts: number, body: string, sec: string = secret) => {
    const payload = `${ts}.${body}`
    const sig = crypto.createHmac('sha256', sec).update(payload).digest('hex')
    return `t=${ts},v1=${sig}`
  }

  test('successfully verifies valid signature', () => {
    const signatureHeader = generateSignature(timestamp, rawBody)
    const result = verifyStripeWebhookSignature({ rawBody, signatureHeader, secret })
    expect(result).toEqual({ valid: true, timestamp })
  })

  test('rejects missing signature header', () => {
    expect(() => verifyStripeWebhookSignature({ rawBody, signatureHeader: null, secret })).toThrow(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_SIGNATURE',
        details: 'Missing Stripe signature header.',
      }),
    )
  })

  test('rejects malformed signature header', () => {
    expect(() =>
      verifyStripeWebhookSignature({ rawBody, signatureHeader: 'invalid_header', secret }),
    ).toThrow(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_SIGNATURE',
        details: 'Malformed Stripe signature header.',
      }),
    )
  })

  test('rejects altered payload body', () => {
    const signatureHeader = generateSignature(timestamp, rawBody)
    const alteredBody = '{"id":"evt_test","type":"payment_intent.failed"}'
    expect(() =>
      verifyStripeWebhookSignature({ rawBody: alteredBody, signatureHeader, secret }),
    ).toThrow(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_SIGNATURE',
        details: 'Stripe signature verification failed.',
      }),
    )
  })

  test('rejects mismatched signature', () => {
    const signatureHeader = generateSignature(timestamp, rawBody, 'wrong_secret')
    expect(() => verifyStripeWebhookSignature({ rawBody, signatureHeader, secret })).toThrow(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_SIGNATURE',
        details: 'Stripe signature verification failed.',
      }),
    )
  })

  test('rejects expired timestamp outside tolerance window', () => {
    const expiredTimestamp = timestamp - 400 // default tolerance is 300
    const signatureHeader = generateSignature(expiredTimestamp, rawBody)
    expect(() => verifyStripeWebhookSignature({ rawBody, signatureHeader, secret })).toThrow(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'TIMESTAMP_OUT_OF_RANGE',
        details: 'Stripe signature timestamp expired or out of tolerance.',
      }),
    )
  })

  test('accepts header with multiple v1 signatures (rollover scenario)', () => {
    const invalidSig = crypto
      .createHmac('sha256', 'old_secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')
    const validSig = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')
    const signatureHeader = `t=${timestamp},v1=${invalidSig},v1=${validSig}`
    const result = verifyStripeWebhookSignature({ rawBody, signatureHeader, secret })
    expect(result).toEqual({ valid: true, timestamp })
  })
})

describe('parseStripeWebhookEvent', () => {
  test('successfully parses valid event', () => {
    const rawBody = JSON.stringify({
      id: 'evt_1',
      type: 'payment',
      data: { object: { id: 'obj_1' } },
    })
    const result = parseStripeWebhookEvent(rawBody)
    expect(result.id).toBe('evt_1')
    expect(result.objectId).toBe('obj_1')
  })

  test('rejects invalid JSON', () => {
    expect(() => parseStripeWebhookEvent('invalid json')).toThrow(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_PAYLOAD',
        details: 'Invalid JSON payload.',
      }),
    )
  })

  test('rejects payload not matching schema', () => {
    const rawBody = JSON.stringify({ id: 'evt_1' }) // missing type and data
    expect(() => parseStripeWebhookEvent(rawBody)).toThrow(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_PAYLOAD',
        details: 'Payload does not match expected Stripe webhook event schema.',
      }),
    )
  })
})
describe('RECORD_STRIPE_WEBHOOK_RECEIPT', () => {
  let mockTx: {
    webhookReceipt: { findUnique: Mock; create: Mock }
    paymentAccount: { findFirst: Mock }
    outboxJob: { create: Mock }
  }

  beforeEach(() => {
    mockTx = {
      webhookReceipt: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      paymentAccount: {
        findFirst: vi.fn(),
      },
      outboxJob: {
        create: vi.fn(),
      },
    }
    vi.spyOn(db, '$transaction').mockImplementation(
      async (cb: (arg: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(mockTx as unknown as Prisma.TransactionClient) as Promise<never>,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const validEvent = {
    id: 'evt_123',
    type: 'payment_intent.succeeded',
    account: 'acct_123',
    data: { object: { id: 'pi_123' } },
    objectId: 'pi_123',
  }

  test('Known account: creates WebhookReceipt and OutboxJob in one transaction', async () => {
    mockTx.webhookReceipt.findUnique.mockResolvedValue(null)
    mockTx.paymentAccount.findFirst.mockResolvedValue({ id: 'pa_123', church_id: 'ch_123' })
    mockTx.webhookReceipt.create.mockResolvedValue({ id: 'wr_123' })
    mockTx.outboxJob.create.mockResolvedValue({ id: 'job_123' })

    const result = await RECORD_STRIPE_WEBHOOK_RECEIPT({ event: validEvent })

    expect(result).toEqual({
      received: true,
      duplicate: false,
      ignored: false,
      receiptId: 'wr_123',
      jobId: 'job_123',
    })
    expect(mockTx.webhookReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'PENDING' }) }),
    )
    expect(mockTx.outboxJob.create).toHaveBeenCalled()
  })

  test('Unknown account: creates WebhookReceipt (IGNORED_UNKNOWN_ACCOUNT) and no OutboxJob', async () => {
    mockTx.webhookReceipt.findUnique.mockResolvedValue(null)
    mockTx.paymentAccount.findFirst.mockResolvedValue(null)
    mockTx.webhookReceipt.create.mockResolvedValue({ id: 'wr_123' })

    const result = await RECORD_STRIPE_WEBHOOK_RECEIPT({ event: validEvent })

    expect(result).toEqual({ received: true, duplicate: false, ignored: true, receiptId: 'wr_123' })
    expect(mockTx.webhookReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'IGNORED_UNKNOWN_ACCOUNT' }),
      }),
    )
    expect(mockTx.outboxJob.create).not.toHaveBeenCalled()
  })

  test('Duplicate delivery: short-circuits and returns duplicate: true', async () => {
    mockTx.webhookReceipt.findUnique.mockResolvedValue({ id: 'wr_dup', state: 'PENDING' })

    const result = await RECORD_STRIPE_WEBHOOK_RECEIPT({ event: validEvent })

    expect(result).toEqual({ received: true, duplicate: true, ignored: false, receiptId: 'wr_dup' })
    expect(mockTx.webhookReceipt.create).not.toHaveBeenCalled()
  })

  test('Concurrent delivery collision (P2002): catches and safely returns duplicate: true', async () => {
    mockTx.webhookReceipt.findUnique.mockResolvedValue(null)
    mockTx.paymentAccount.findFirst.mockResolvedValue({ id: 'pa_123', church_id: 'ch_123' })
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    })
    mockTx.webhookReceipt.create.mockRejectedValue(p2002)

    const result = await RECORD_STRIPE_WEBHOOK_RECEIPT({ event: validEvent })

    expect(result).toEqual({ received: true, duplicate: true, ignored: false })
  })
})
