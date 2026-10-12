/**
 * @vitest-environment node
 */
import crypto from 'node:crypto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initiateDonation } from '@/controller/donation'
import { ENSURE_CHURCH_DONATION_ELIGIBLE } from '@/providers/donation'
import { STRIPE } from '@/providers/stripe'
import { GeneralError } from '@/utils/general-error'
import { hashContent } from '@/utils/hash'
const findUniqueChurch = vi.fn()
const findFirstIdempotency = vi.fn()
const createIdempotency = vi.fn()
const deleteIdempotency = vi.fn()
const updateIdempotency = vi.fn()
const deleteManyIdempotency = vi.fn()

const fakeTx = {
  idempotencyRecord: {
    findFirst: findFirstIdempotency,
    create: createIdempotency,
    delete: deleteIdempotency,
  },
}

vi.mock('@/utils/db-connection', () => ({
  db: {
    church: {
      findUnique: (...args: unknown[]) => findUniqueChurch(...args),
    },
    idempotencyRecord: {
      update: (...args: unknown[]) => updateIdempotency(...args),
      deleteMany: (...args: unknown[]) => deleteManyIdempotency(...args),
    },
  },
}))

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakeTx)),
}))

type IdempotencyRecordMock = {
  id: string
  actor_key: string
  operation: string
  key: string
  request_hash: string
  state: 'PENDING' | 'COMPLETED'
  resource_id: string | null
  expires_at: Date
}

let idempotencyStore: Record<string, IdempotencyRecordMock> = {}

const setupIdempotencyMocks = () => {
  idempotencyStore = {}

  findFirstIdempotency.mockImplementation(
    async ({ where }: { where: { actor_key: string; operation: string; key: string } }) => {
      const k = `${where.actor_key}:${where.operation}:${where.key}`
      return idempotencyStore[k] ?? null
    },
  )

  createIdempotency.mockImplementation(
    async ({ data }: { data: Omit<IdempotencyRecordMock, 'id'> }) => {
      const record: IdempotencyRecordMock = {
        id: crypto.randomUUID(),
        ...data,
        resource_id: data.resource_id ?? null,
      }
      const k = `${record.actor_key}:${record.operation}:${record.key}`
      idempotencyStore[k] = record
      return record
    },
  )

  deleteIdempotency.mockImplementation(async ({ where }: { where: { id: string } }) => {
    for (const k of Object.keys(idempotencyStore)) {
      if (idempotencyStore[k].id === where.id) {
        delete idempotencyStore[k]
        break
      }
    }
  })

  updateIdempotency.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: Partial<IdempotencyRecordMock> }) => {
      for (const k of Object.keys(idempotencyStore)) {
        if (idempotencyStore[k].id === where.id) {
          idempotencyStore[k] = { ...idempotencyStore[k], ...data }
          return idempotencyStore[k]
        }
      }
      return null
    },
  )

  deleteManyIdempotency.mockImplementation(async ({ where }: { where: { id: string } }) => {
    for (const k of Object.keys(idempotencyStore)) {
      if (idempotencyStore[k].id === where.id) {
        delete idempotencyStore[k]
      }
    }
    return { count: 1 }
  })
}

describe('DO-09: Platform Account Resolution and Security Constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupIdempotencyMocks()
    findUniqueChurch.mockResolvedValue({
      id: 'c1',
      name: 'Test Church',
      status: 'APPROVED',
    })
  })

  describe('Category 1: Church Donation Eligibility', () => {
    it('successfully confirms an approved church is eligible to receive donations', async () => {
      findUniqueChurch.mockResolvedValueOnce({
        id: 'c-app',
        name: 'Test Church',
        status: 'APPROVED',
      })
      const result = await ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: 'c-app' })
      expect(result.churchId).toBe('c-app')
      expect(result.churchName).toBe('Test Church')
    })

    it('returns 404 CHURCH_NOT_FOUND for non-existent church', async () => {
      findUniqueChurch.mockResolvedValueOnce(null)
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
      findUniqueChurch.mockResolvedValueOnce({
        id: 'c-pend',
        name: 'Pending Church',
        status: 'PENDING',
      })
      await expect(ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: 'c-pend' })).rejects.toMatchObject({
        error_code: 'CHURCH_NOT_ELIGIBLE',
      })
    })

    it('returns 400 CHURCH_NOT_ELIGIBLE if church status is SUSPENDED', async () => {
      findUniqueChurch.mockResolvedValueOnce({
        id: 'c-susp',
        name: 'Suspended Church',
        status: 'SUSPENDED',
      })
      await expect(ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: 'c-susp' })).rejects.toMatchObject({
        error_code: 'CHURCH_NOT_ELIGIBLE',
      })
    })

    it('returns 400 CHURCH_NOT_ELIGIBLE if church status is ARCHIVED', async () => {
      findUniqueChurch.mockResolvedValueOnce({
        id: 'c-arch',
        name: 'Archived Church',
        status: 'ARCHIVED',
      })
      await expect(ENSURE_CHURCH_DONATION_ELIGIBLE({ churchId: 'c-arch' })).rejects.toMatchObject({
        error_code: 'CHURCH_NOT_ELIGIBLE',
      })
    })
  })

  describe('Category 2: Raw Card Data Rejection', () => {
    const churchId = 'c1'

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
    const churchId = 'c1'

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
    const churchId = 'c1'

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

    it('throws IDEMPOTENCY_REPLAY_FAILED when idempotency record resource_id is null', async () => {
      const idempotencyKey = 'idem-key-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()
      const input = { amountMinor: 5000, currency: 'usd', frequency: 'one_time' }

      const k = `${userId}:initiate_donation:${idempotencyKey}`
      idempotencyStore[k] = {
        id: crypto.randomUUID(),
        actor_key: userId,
        operation: 'initiate_donation',
        key: idempotencyKey,
        request_hash: hashContent(JSON.stringify(input)),
        state: 'COMPLETED',
        resource_id: null,
        expires_at: new Date(Date.now() + 60000),
      }

      await expect(
        initiateDonation({ churchId, userId, input, idempotencyKey }),
      ).rejects.toMatchObject({
        error_code: 'IDEMPOTENCY_REPLAY_FAILED',
        details: 'Idempotency record has no session data.',
      })
    })

    it('throws IDEMPOTENCY_REPLAY_FAILED when idempotency record session JSON is corrupt', async () => {
      const idempotencyKey = 'idem-key-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()
      const input = { amountMinor: 5000, currency: 'usd', frequency: 'one_time' }

      const k = `${userId}:initiate_donation:${idempotencyKey}`
      idempotencyStore[k] = {
        id: crypto.randomUUID(),
        actor_key: userId,
        operation: 'initiate_donation',
        key: idempotencyKey,
        request_hash: hashContent(JSON.stringify(input)),
        state: 'COMPLETED',
        resource_id: '{ invalid json: ',
        expires_at: new Date(Date.now() + 60000),
      }

      await expect(
        initiateDonation({ churchId, userId, input, idempotencyKey }),
      ).rejects.toMatchObject({
        error_code: 'IDEMPOTENCY_REPLAY_FAILED',
        details: 'Stored idempotency session payload is corrupt.',
      })
    })

    it('throws IDEMPOTENCY_REPLAY_FAILED when idempotency record session format is invalid', async () => {
      const idempotencyKey = 'idem-key-' + crypto.randomUUID()
      const userId = 'user-' + crypto.randomUUID()
      const input = { amountMinor: 5000, currency: 'usd', frequency: 'one_time' }

      const k = `${userId}:initiate_donation:${idempotencyKey}`
      idempotencyStore[k] = {
        id: crypto.randomUUID(),
        actor_key: userId,
        operation: 'initiate_donation',
        key: idempotencyKey,
        request_hash: hashContent(JSON.stringify(input)),
        state: 'COMPLETED',
        resource_id: JSON.stringify({ notASession: true }),
        expires_at: new Date(Date.now() + 60000),
      }

      await expect(
        initiateDonation({ churchId, userId, input, idempotencyKey }),
      ).rejects.toMatchObject({
        error_code: 'IDEMPOTENCY_REPLAY_FAILED',
        details: 'Stored idempotency session payload is corrupt.',
      })
    })
  })
})
