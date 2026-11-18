import { PRAYER_CATALOGUE, PRAYER_ROLES } from '../../prisma/seeds/prayer-roles'
import { describe, expect, it } from 'vitest'
import {
  DonationInputSchema,
  assertNoRawCardData,
  DateRangeSchema,
  DonationLedgerStatusSchema,
  DonationRowSchema,
  DonationSubscriptionRowSchema,
  DonationSummarySchema,
  AdminDonationRowSchema,
  PublicDonationInitiateSchema,
  PublicDonationStatusQuerySchema,
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
        churchId: 'c1',
        churchName: 'Hope Church',
        frequency: 'Monthly',
        invoiceUrl: null,
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
            count: 3,
          },
          {
            currency: 'usd',
            grossMinor: '5000',
            refundedMinor: '0',
            netMinor: '5000',
            count: 1,
          },
        ],
      }
      expect(DonationSummarySchema.parse(summary)).toEqual(summary)
    })

    it('keeps DonationRowSchema free of donor PII (mobile contract, T-08)', () => {
      // The admin extension is a separate schema: stripping the extra keys here is
      // what proves the mobile-facing shape did not grow.
      const parsed = DonationRowSchema.parse({
        id: 'd1',
        amountMinor: '5000',
        currency: 'usd',
        status: 'PAID',
        paidAt: null,
        ref: 'pi_test_123',
        churchId: 'c1',
        donor: { name: 'Mari', email: 'mari@example.com' },
      })
      expect(parsed).not.toHaveProperty('churchId')
      expect(parsed).not.toHaveProperty('donor')
    })
  })
})

describe('Admin donation report schemas (D-03 / T-01)', () => {
  const adminRow = {
    id: 'd1',
    amountMinor: '5000',
    currency: 'eur',
    status: 'PAID',
    paidAt: new Date('2026-11-02T00:00:00Z'),
    ref: 'pi_test_123',
    churchId: 'p1',
    churchName: 'Prayer 365',
    type: 'PRAYER' as const,
    refundedMinor: '0',
    donor: null,
    invoiceUrl: null,
  }

  it('accepts a prayer gift with no donor', () => {
    expect(AdminDonationRowSchema.parse(adminRow)).toEqual(adminRow)
  })

  it('accepts a registered donor', () => {
    const donor = { name: 'Mari', email: 'mari@example.com' }
    expect(AdminDonationRowSchema.parse({ ...adminRow, type: 'CHURCH', donor }).donor).toEqual(
      donor,
    )
  })

  it('rejects an unknown type', () => {
    expect(AdminDonationRowSchema.safeParse({ ...adminRow, type: 'PARISH' }).success).toBe(false)
  })

  it('accepts only the three ledger states', () => {
    expect(DonationLedgerStatusSchema.options).toEqual(['PAID', 'FAILED', 'REFUNDED'])
    expect(DonationLedgerStatusSchema.safeParse('PAID').success).toBe(true)
    expect(DonationLedgerStatusSchema.safeParse('pending').success).toBe(false)
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

describe('PublicDonationInitiateSchema (PD-API-01)', () => {
  const valid = { amountMinor: 1000, currency: 'eur', frequency: 'one_time' }

  it('accepts the amount bounds (1 EUR to 5,000 EUR)', () => {
    expect(PublicDonationInitiateSchema.parse(valid).amountMinor).toBe(1000)
    expect(PublicDonationInitiateSchema.parse({ ...valid, amountMinor: 100 })).toBeTruthy()
    expect(PublicDonationInitiateSchema.parse({ ...valid, amountMinor: 500_000 })).toBeTruthy()
  })

  it.each([
    ['below the minimum', { ...valid, amountMinor: 99 }],
    ['above the maximum', { ...valid, amountMinor: 500_001 }],
    ['a float amount', { ...valid, amountMinor: 1000.5 }],
    ['uppercase currency', { ...valid, currency: 'EUR' }],
    ['a monthly frequency', { ...valid, frequency: 'monthly' }],
  ])('rejects %s', (_name, payload) => {
    expect(() => PublicDonationInitiateSchema.parse(payload)).toThrow()
  })

  it.each([
    ['churchId', { ...valid, churchId: 'c1' }],
    ['successUrl', { ...valid, successUrl: 'https://evil.test/return' }],
    ['cancelUrl', { ...valid, cancelUrl: 'https://evil.test/cancel' }],
    ['category', { ...valid, category: 'pantry' }],
    ['userId', { ...valid, userId: 'u1' }],
  ])('rejects an unknown %s field (strict)', (_name, payload) => {
    expect(() => PublicDonationInitiateSchema.parse(payload)).toThrow()
  })
})

describe('PublicDonationStatusQuerySchema (PD-API-01)', () => {
  it('accepts a checkout session id', () => {
    expect(PublicDonationStatusQuerySchema.parse({ sessionId: 'cs_test_a1B2c3' }).sessionId).toBe(
      'cs_test_a1B2c3',
    )
  })

  it.each([['pi_123'], [''], ['cs_' + 'a'.repeat(2) + '-bad'], ['../etc/passwd']])(
    'rejects a non cs_ session id (%s)',
    (sessionId) => {
      expect(() => PublicDonationStatusQuerySchema.parse({ sessionId })).toThrow()
    },
  )

  it('rejects an extra query field (strict)', () => {
    expect(() =>
      PublicDonationStatusQuerySchema.parse({ sessionId: 'cs_abc', churchId: 'c1' }),
    ).toThrow()
  })
})
