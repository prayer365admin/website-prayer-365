// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openBillingPortal } from '@/controller/donation'
import { STRIPE } from '@/providers/stripe'

const findFirst = vi.fn()

vi.mock('@/utils/db-connection', () => ({
  db: {
    donationSubscription: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}))

describe('openBillingPortal (W11 "Pause or Modify Monthly Pledge")', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    findFirst.mockReset()
  })

  it('refuses a giver with no active pledge instead of opening an empty portal', async () => {
    findFirst.mockResolvedValue(null)
    const retrieve = vi.spyOn(STRIPE, 'retrieveSubscription')

    await expect(
      openBillingPortal({ userId: 'u1', returnUrl: 'https://site.test/donate' }),
    ).rejects.toMatchObject({ code: 404, error_code: 'NO_ACTIVE_SUBSCRIPTION' })
    expect(retrieve).not.toHaveBeenCalled()
  })

  it('opens the portal for the customer behind the giver’s own subscription', async () => {
    findFirst.mockResolvedValue({ provider_subscription_id: 'sub_1' })
    const retrieve = vi
      .spyOn(STRIPE, 'retrieveSubscription')
      .mockResolvedValue({ id: 'sub_1', status: 'active', customer: 'cus_1' })
    const create = vi
      .spyOn(STRIPE, 'createBillingPortalSession')
      .mockResolvedValue({ url: 'https://billing.stripe.test/p_1' })

    const result = await openBillingPortal({
      userId: 'u1',
      returnUrl: 'https://site.test/donate?church=st-john',
    })

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'u1', provider_status: 'active' } }),
    )
    expect(retrieve).toHaveBeenCalledWith('sub_1')
    expect(create).toHaveBeenCalledWith({
      customerId: 'cus_1',
      returnUrl: 'https://site.test/donate?church=st-john',
    })
    expect(result).toEqual({ url: 'https://billing.stripe.test/p_1' })
  })

  it('fails loudly when the provider subscription carries no customer', async () => {
    findFirst.mockResolvedValue({ provider_subscription_id: 'sub_1' })
    vi.spyOn(STRIPE, 'retrieveSubscription').mockResolvedValue({ id: 'sub_1', status: 'active' })
    const create = vi.spyOn(STRIPE, 'createBillingPortalSession')

    await expect(
      openBillingPortal({ userId: 'u1', returnUrl: 'https://site.test/donate' }),
    ).rejects.toMatchObject({ code: 502, error_code: 'STRIPE_CUSTOMER_MISSING' })
    expect(create).not.toHaveBeenCalled()
  })
})
