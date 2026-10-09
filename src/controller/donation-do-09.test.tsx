/**
 * @vitest-environment node
 */
import crypto from 'node:crypto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/utils/db-connection'
import { initiateDonation } from '@/controller/donation'
import { ENSURE_CHURCH_DONATION_ELIGIBLE } from '@/providers/donation'
import { STRIPE } from '@/providers/stripe'
import { GeneralError } from '@/utils/general-error'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createTestChurch(opts: { status: any }) {
  const org = await db.orgNode.create({
    data: {
      name: 'Test Org ' + crypto.randomUUID(),
      kind: 'CHURCH',
    },
  })

  return await db.church.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Test Church ' + crypto.randomUUID(),
      timezone: 'UTC',
      org_node_id: org.id,
      address: {},
      contacts: [],
      social_links: {},
      status: opts.status,
    },
  })
}

describe('DO-09: Platform Account Resolution and Security Constraints', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
  })

  describe('Category 1: Church Donation Eligibility', () => {
    it('successfully confirms an approved church is eligible to receive donations', async () => {
      const church = await createTestChurch({ status: 'APPROVED' })
      const result = await ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: church.id })
      expect(result.churchId).toBe(church.id)
      expect(result.churchName).toBe(church.name)
    })

    it('returns 404 CHURCH_NOT_FOUND for non-existent church', async () => {
      await expect(ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: 'nope' })).rejects.toThrow(
        new GeneralError({
          code: 404,
          error: 'NOT_FOUND',
          error_code: 'CHURCH_NOT_FOUND',
          details: 'Church not found.',
        }),
      )
    })

    it('returns 400 CHURCH_NOT_ELIGIBLE if church status is PENDING', async () => {
      const church = await createTestChurch({ status: 'PENDING' })
      await expect(ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: church.id })).rejects.toMatchObject({
        error_code: 'CHURCH_NOT_ELIGIBLE',
      })
    })

    it('returns 400 CHURCH_NOT_ELIGIBLE if church status is SUSPENDED', async () => {
      const church = await createTestChurch({ status: 'SUSPENDED' })
      await expect(ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: church.id })).rejects.toMatchObject({
        error_code: 'CHURCH_NOT_ELIGIBLE',
      })
    })

    it('returns 400 CHURCH_NOT_ELIGIBLE if church status is ARCHIVED', async () => {
      const church = await createTestChurch({ status: 'ARCHIVED' })
      await expect(ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: church.id })).rejects.toMatchObject({
        error_code: 'CHURCH_NOT_ELIGIBLE',
      })
    })
  })

  describe('Category 2: Raw Card Data Rejection', () => {
    let churchId: string
    beforeEach(async () => {
      const church = await createTestChurch({ status: 'APPROVED' })
      churchId = church.id
    })

    it('rejects payload with cardNumber', async () => {
      const input = {
        amountMinor: 5000,
        currency: 'usd',
        frequency: 'one_time',
        cardNumber: '4111222233334444',
      }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'RAW_CARD_DATA_FORBIDDEN',
      })
    })

    it('rejects payload with card_number', async () => {
      const input = {
        amountMinor: 5000,
        currency: 'usd',
        frequency: 'one_time',
        card_number: '4111222233334444',
      }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'RAW_CARD_DATA_FORBIDDEN',
      })
    })

    it('rejects payload with cvc', async () => {
      const input = {
        amountMinor: 5000,
        currency: 'usd',
        frequency: 'one_time',
        cvc: '123',
      }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'RAW_CARD_DATA_FORBIDDEN',
      })
    })

    it('rejects payload with cvv', async () => {
      const input = {
        amountMinor: 5000,
        currency: 'usd',
        frequency: 'one_time',
        cvv: '123',
      }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'RAW_CARD_DATA_FORBIDDEN',
      })
    })

    it('rejects payload with exp_month and exp_year', async () => {
      const input = {
        amountMinor: 5000,
        currency: 'usd',
        frequency: 'one_time',
        exp_month: 12,
        exp_year: 2028,
      }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'RAW_CARD_DATA_FORBIDDEN',
      })
    })

    it('rejects deeply nested card data in payload', async () => {
      const input = {
        amountMinor: 5000,
        currency: 'usd',
        frequency: 'one_time',
        customMetadata: {
          nested: {
            pan: '4111222233334444',
          },
        },
      }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'RAW_CARD_DATA_FORBIDDEN',
      })
    })

    it('rejects unexpected properties via strict schema', async () => {
      const input = {
        amountMinor: 5000,
        currency: 'usd',
        frequency: 'one_time',
        extraField: 'should_fail',
      }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'VALIDATION_ERROR',
      })
    })
  })

  describe('Category 3: D6 Charge Model, Currencies, and Amounts', () => {
    let churchId: string
    beforeEach(async () => {
      const church = await createTestChurch({ status: 'APPROVED' })
      churchId = church.id
    })

    it('rejects zero amount', async () => {
      const input = { amountMinor: 0, currency: 'usd', frequency: 'one_time' }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'VALIDATION_ERROR',
      })
    })

    it('rejects negative amount', async () => {
      const input = { amountMinor: -1000, currency: 'usd', frequency: 'one_time' }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'VALIDATION_ERROR',
      })
    })

    it('rejects fractional float amount', async () => {
      const input = { amountMinor: 10.5, currency: 'usd', frequency: 'one_time' }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'VALIDATION_ERROR',
      })
    })

    it('rejects invalid currency strings', async () => {
      const input = { amountMinor: 5000, currency: 'US', frequency: 'one_time' }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'VALIDATION_ERROR',
      })
    })

    it('accepts valid amounts and normalizes currency', async () => {
      vi.spyOn(STRIPE, 'createCheckoutSession').mockResolvedValue({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })
      const input = { amountMinor: 5000, currency: 'USD', frequency: 'one_time' }
      const res = await initiateDonation({ churchId, input })
      expect(res.amountMinor).toBe(5000)
      expect(res.currency).toBe('usd')
      expect(res.frequency).toBe('one_time')
    })

    it('rejects invalid frequency', async () => {
      const input = { amountMinor: 5000, currency: 'usd', frequency: 'yearly' }
      await expect(initiateDonation({ churchId, input })).rejects.toMatchObject({
        error_code: 'VALIDATION_ERROR',
      })
    })
  })

  describe('Category 4: Provider Delegation & Idempotency', () => {
    let churchId: string
    beforeEach(async () => {
      const church = await createTestChurch({ status: 'APPROVED' })
      churchId = church.id
    })

    it('delegates checkout session creation to provider with church account', async () => {
      const createSpy = vi.spyOn(STRIPE, 'createCheckoutSession').mockResolvedValue({
        sessionId: 'cs_test_delegate',
        url: 'https://checkout.stripe.com/pay/cs_test_delegate',
      })
      const input = { amountMinor: 6000, currency: 'eur', frequency: 'monthly' }
      const res = await initiateDonation({ churchId, input })

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          churchId,
          amountMinor: 6000,
          currency: 'eur',
          frequency: 'monthly',
        }),
      )
      expect(res.sessionId).toBe('cs_test_delegate')
      expect(res.url).toBe('https://checkout.stripe.com/pay/cs_test_delegate')
      expect((res as Record<string, unknown>).providerAccountId).toBeUndefined()
    })

    it('replays identical session for identical idempotencyKey', async () => {
      let callCount = 0
      vi.spyOn(STRIPE, 'createCheckoutSession').mockImplementation(async () => {
        callCount++
        return {
          sessionId: `cs_test_idem_${callCount}`,
          url: `https://checkout.stripe.com/pay/cs_test_idem_${callCount}`,
        }
      })

      const input = { amountMinor: 5000, currency: 'usd', frequency: 'one_time' }
      const idempotencyKey = 'idem-key-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()

      const res1 = await initiateDonation({ churchId, userId, input, idempotencyKey })
      const res2 = await initiateDonation({ churchId, userId, input, idempotencyKey })

      expect(callCount).toBe(1)
      expect(res1.sessionId).toBe('cs_test_idem_1')
      expect(res2.sessionId).toBe('cs_test_idem_1')
    })

    it('returns 409 IDEMPOTENCY_CONFLICT for same key but different inputs', async () => {
      vi.spyOn(STRIPE, 'createCheckoutSession').mockResolvedValue({
        sessionId: 'cs_test_conflict',
        url: 'https://checkout.stripe.com/pay/cs_test_conflict',
      })

      const idempotencyKey = 'idem-key-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()

      const input1 = { amountMinor: 5000, currency: 'usd', frequency: 'one_time' }
      await initiateDonation({ churchId, userId, input: input1, idempotencyKey })

      const input2 = { amountMinor: 6000, currency: 'usd', frequency: 'one_time' }
      await expect(
        initiateDonation({ churchId, userId, input: input2, idempotencyKey }),
      ).rejects.toMatchObject({
        error_code: 'IDEMPOTENCY_CONFLICT',
      })
    })
  })
})
