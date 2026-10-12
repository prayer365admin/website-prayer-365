import { describe, expect, it } from 'vitest'
import { StripeWebhookEventSchema, StripeWebhookResultSchema } from './stripe-webhook'

describe('Stripe Webhook Models', () => {
  describe('StripeWebhookEventSchema', () => {
    it('validates standard webhook event payloads', () => {
      const payload = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        account: 'acct_test_456',
        created: 1750000000,
        data: {
          object: {
            id: 'pi_test_789',
            amount: 5000,
          },
        },
      }
      const parsed = StripeWebhookEventSchema.parse(payload)
      expect(parsed.id).toBe('evt_test_123')
      expect(parsed.type).toBe('payment_intent.succeeded')
      expect(parsed.account).toBe('acct_test_456')
      expect(parsed.created).toBe(1750000000)
    })

    it('rejects events missing id or type', () => {
      expect(() =>
        StripeWebhookEventSchema.parse({
          type: 'payment_intent.succeeded',
          data: { object: {} },
        }),
      ).toThrow()

      expect(() =>
        StripeWebhookEventSchema.parse({
          id: 'evt_test',
          data: { object: {} },
        }),
      ).toThrow()
    })
  })

  describe('StripeWebhookResultSchema', () => {
    it('validates receipt outcomes', () => {
      const result = {
        received: true,
        duplicate: false,
        ignored: false,
        receiptId: 'rcpt_1',
        jobId: 'job_1',
      }
      expect(StripeWebhookResultSchema.parse(result)).toEqual(result)
    })
  })
})
