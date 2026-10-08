import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest'
import { handleStripeWebhook } from './stripe-webhook'
import { GeneralError } from '@/utils/general-error'

const mockVerify = vi.hoisted(() => vi.fn())
const mockParse = vi.hoisted(() => vi.fn())
const mockRecord = vi.hoisted(() => vi.fn())

vi.mock('@/providers/stripe-webhook', () => ({
  verifyStripeWebhookSignature: mockVerify,
  parseStripeWebhookEvent: mockParse,
  RECORD_STRIPE_WEBHOOK_RECEIPT: mockRecord,
}))

describe('handleStripeWebhook', () => {
  const originalEnv = process.env.STRIPE_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalEnv
    vi.clearAllMocks()
  })

  test('successfully coordinates signature check and persistence', async () => {
    mockVerify.mockReturnValue({ valid: true, timestamp: 123 })
    mockParse.mockReturnValue({ id: 'evt_1', type: 'payment', objectId: 'obj_1' })
    mockRecord.mockResolvedValue({ received: true, duplicate: false, receiptId: 'wr_1' })

    const result = await handleStripeWebhook({
      rawBody: '{"id":"evt_1"}',
      signatureHeader: 't=123,v1=sig',
    })

    expect(result).toEqual({ received: true, duplicate: false, receiptId: 'wr_1' })
    expect(mockVerify).toHaveBeenCalledWith({
      rawBody: '{"id":"evt_1"}',
      signatureHeader: 't=123,v1=sig',
      secret: 'whsec_test',
    })
    expect(mockParse).toHaveBeenCalledWith('{"id":"evt_1"}')
    expect(mockRecord).toHaveBeenCalledWith({
      event: { id: 'evt_1', type: 'payment', objectId: 'obj_1' },
    })
  })

  test('throws 500 when STRIPE_WEBHOOK_SECRET is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    await expect(handleStripeWebhook({ rawBody: '{}', signatureHeader: 'sig' })).rejects.toThrow(
      new GeneralError({
        code: 500,
        error: 'CONFIGURATION_ERROR',
        error_code: 'STRIPE_WEBHOOK_SECRET_MISSING',
        details: 'Stripe webhook signing secret is not configured.',
      }),
    )
    expect(mockVerify).not.toHaveBeenCalled()
  })

  test('throws when verifyStripeWebhookSignature throws', async () => {
    const error = new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_SIGNATURE',
      details: 'test',
    })
    mockVerify.mockImplementation(() => {
      throw error
    })

    await expect(handleStripeWebhook({ rawBody: '{}', signatureHeader: 'sig' })).rejects.toThrow(
      error,
    )
  })

  test('throws when parseStripeWebhookEvent throws', async () => {
    mockVerify.mockReturnValue({ valid: true, timestamp: 123 })
    const error = new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_PAYLOAD',
      details: 'test',
    })
    mockParse.mockImplementation(() => {
      throw error
    })

    await expect(handleStripeWebhook({ rawBody: '{}', signatureHeader: 'sig' })).rejects.toThrow(
      error,
    )
  })
})
