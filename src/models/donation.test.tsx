import { PRAYER_CATALOGUE, PRAYER_ROLES } from '../../prisma/seeds/prayer-roles'
import { describe, expect, it } from 'vitest'
import {
  DonationInputSchema,
  assertNoRawCardData,
  DateRangeSchema,
  ResolvedPaymentAccountSchema,
  DonationRowSchema,
  DonationSubscriptionRowSchema,
  DonationSummarySchema,
} from './donation'
import { GeneralError } from '@/utils/general-error'

describe('Donation Models and Schemas', () => {
  describe('DonationInputSchema', () => {
    it('validates and normalizes valid donation input', () => {
      const parsed = DonationInputSchema.parse({
        amountMinor: 5000,
        currency: 'USD',
        frequency: 'one_time',
      })
      expect(parsed.amountMinor).toBe(5000)
      expect(parsed.currency).toBe('usd')
      expect(parsed.frequency).toBe('one_time')
    })

    it('rejects non-positive and float amounts', () => {
      expect(() =>
        DonationInputSchema.parse({
          amountMinor: 0,
          currency: 'usd',
          frequency: 'one_time',
        }),
      ).toThrow()

      expect(() =>
        DonationInputSchema.parse({
          amountMinor: -100,
          currency: 'usd',
          frequency: 'one_time',
        }),
      ).toThrow()

      expect(() =>
        DonationInputSchema.parse({
          amountMinor: 10.5,
          currency: 'usd',
          frequency: 'one_time',
        }),
      ).toThrow()
    })

    it('rejects invalid currency codes', () => {
      expect(() =>
        DonationInputSchema.parse({
          amountMinor: 1000,
          currency: 'US',
          frequency: 'one_time',
        }),
      ).toThrow()

      expect(() =>
        DonationInputSchema.parse({
          amountMinor: 1000,
          currency: 'USDT',
          frequency: 'one_time',
        }),
      ).toThrow()
    })

    it('rejects unexpected properties via strict schema', () => {
      expect(() =>
        DonationInputSchema.parse({
          amountMinor: 1000,
          currency: 'usd',
          frequency: 'one_time',
          extraField: 'unexpected',
        }),
      ).toThrow()
    })
  })

  describe('assertNoRawCardData', () => {
    it('passes clean payloads without card data', () => {
      expect(() =>
        assertNoRawCardData({
          amount: 5000,
          donor_name: 'John Doe',
          notes: 'General donation',
        }),
      ).not.toThrow()
    })

    it('rejects cardholder data fields and throws RAW_CARD_DATA_FORBIDDEN', () => {
      const sensitiveKeys = ['card_number', 'pan', 'cvv', 'cvc', 'expiry', 'track_data']
      for (const key of sensitiveKeys) {
        expect(() => assertNoRawCardData({ [key]: '1234' })).toThrow(
          expect.objectContaining({
            code: 422,
            error_code: 'RAW_CARD_DATA_FORBIDDEN',
          }),
        )
      }
    })

    it('detects nested sensitive card data', () => {
      expect(() =>
        assertNoRawCardData({
          payment: {
            details: {
              card_number: '4111222233334444',
            },
          },
        }),
      ).toThrow(GeneralError)
    })
  })

  describe('DateRangeSchema', () => {
    it('accepts empty date ranges', () => {
      const parsed = DateRangeSchema.parse({})
      expect(parsed.from).toBeUndefined()
      expect(parsed.to).toBeUndefined()
    })

    it('parses valid ISO string dates', () => {
      const parsed = DateRangeSchema.parse({
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T23:59:59.999Z',
      })
      expect(parsed.from).toBeInstanceOf(Date)
      expect(parsed.to).toBeInstanceOf(Date)
    })

    it('rejects when from date is after to date', () => {
      expect(() =>
        DateRangeSchema.parse({
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-09-01T00:00:00.000Z',
        }),
      ).toThrow()
    })
  })

  describe('Row and Summary DTO Schemas', () => {
    it('validates DonationRowSchema including status', () => {
      const row = {
        id: 'd1',
        amountMinor: '5000',
        currency: 'usd',
        status: 'PAID',
        paidAt: new Date(),
        ref: 'pi_test_123',
      }
      expect(DonationRowSchema.parse(row)).toEqual(row)
    })

    it('validates DonationSubscriptionRowSchema', () => {
      const row = {
        id: 'sub1',
        amountMinor: '2500',
        currency: 'eur',
        providerStatus: 'active',
        createdAt: new Date(),
      }
      expect(DonationSubscriptionRowSchema.parse(row)).toEqual(row)
    })

    it('validates DonationSummarySchema', () => {
      const summary = {
        month: '2026-10',
        currencies: [
          {
            currency: 'eur',
            grossMinor: '10000',
            refundedMinor: '2000',
            netMinor: '8000',
          },
          {
            currency: 'usd',
            grossMinor: '5000',
            refundedMinor: '0',
            netMinor: '5000',
          },
        ],
      }
      expect(DonationSummarySchema.parse(summary)).toEqual(summary)
    })

    it('validates ResolvedPaymentAccountSchema', () => {
      const acct = {
        churchId: 'c1',
        churchName: 'Test Church',
        paymentAccountId: 'pa1',
        provider: 'stripe',
        providerAccountId: 'acct_stripe_1',
        status: 'ACTIVE',
      }
      expect(ResolvedPaymentAccountSchema.parse(acct)).toEqual(acct)
    })
  })
})

describe('F8DO permission catalogue guard', () => {
  it('defines no donation subjects beyond prayer_donation (SPEC §Permissions)', () => {
    const subjects = PRAYER_CATALOGUE.map((g) => g.subject)
    expect(subjects.filter((s) => s.startsWith('prayer_donation'))).toEqual(['prayer_donation'])
  })
  it('role grant matrices reference only catalogue subjects', () => {
    const catalogue = new Set(PRAYER_CATALOGUE.map((g) => g.subject))
    for (const role of PRAYER_ROLES) {
      for (const g of role.grants) expect(catalogue.has(g.subject)).toBe(true)
    }
  })
})
