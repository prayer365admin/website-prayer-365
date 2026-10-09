import { db } from '../../src/utils/db-connection'
import { getDemoChurch } from './test-context'

export const seedDonations = async () => {
  const church = await getDemoChurch()
  if (!church) return

  // Seed recurring subscription
  const existingSub = await db.donationSubscription.findUnique({
    where: {
      provider_subscription_id: 'sub_demo_monthly_1',
    },
  })

  let subId = existingSub?.id
  if (!existingSub) {
    const sub = await db.donationSubscription.create({
      data: {
        church_id: church.id,
        provider_subscription_id: 'sub_demo_monthly_1',
        amount_minor: BigInt(2500),
        currency: 'eur',
        provider_status: 'active',
      },
    })
    subId = sub.id
  }

  // Seed sample donations if none exist
  const existingDonations = await db.donation.count({
    where: { church_id: church.id },
  })

  if (existingDonations === 0) {
    const now = new Date()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

    await db.donation.createMany({
      data: [
        {
          church_id: church.id,
          provider_payment_id: 'pi_demo_eur_paid',
          amount_minor: BigInt(5000),
          currency: 'eur',
          status: 'PAID',
          paid_at: now,
          subscription_id: subId,
        },
        {
          church_id: church.id,
          provider_payment_id: 'pi_demo_usd_paid',
          amount_minor: BigInt(10000),
          currency: 'usd',
          status: 'PAID',
          paid_at: yesterday,
        },
        {
          church_id: church.id,
          provider_payment_id: 'pi_demo_eur_failed',
          amount_minor: BigInt(2500),
          currency: 'eur',
          status: 'FAILED',
          paid_at: null,
        },
        {
          church_id: church.id,
          provider_payment_id: 'pi_demo_eur_refunded',
          amount_minor: BigInt(3000),
          refunded_minor: BigInt(3000),
          currency: 'eur',
          status: 'REFUNDED',
          paid_at: yesterday,
        },
      ],
    })
  }
}
