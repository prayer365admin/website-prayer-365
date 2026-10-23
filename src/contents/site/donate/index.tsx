'use client'

import BoxContainer from '@/components/container/boxed'
import { DonateNeighborSpotlight, MyDonationOverview } from '@/models/donation'
import { MobileDonationOptions } from '@/models/mobile'
import { DonateHero } from './hero'
import { DonorForm } from './donor-form'
import { DONATION_FALLBACK_OPTIONS } from './data'
import { SupporterOverview } from './supporter-overview'

/** W11 Giving & Stewardship Portal (WB-41). Server page supplies the church, the giver's own ledger and the flag. */
export default function ContentsSiteDonate({
  church,
  overview,
  userName,
  stripeReady,
  oneTime = false,
  neighbor = null,
}: {
  /** null → no beneficiary chosen yet, so the form is gated on picking one. */
  church: {
    churchId: string
    slug?: string
    churchName: string
    isMainParish: boolean
    donationOptions?: MobileDonationOptions
  } | null
  overview: MyDonationOverview | null
  userName: string | null
  stripeReady: boolean
  /** Start the form on a one-time gift instead of the church's monthly default. */
  oneTime?: boolean
  /** Nearest other parish with a published prayer, or null. */
  neighbor?: DonateNeighborSpotlight | null
}) {
  return (
    <BoxContainer containerClassName="py-8">
      <div className="flex min-w-0 flex-col gap-10">
        <DonateHero />
        {church && overview ? (
          <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,658.67fr)_minmax(0,461.33fr)]">
            <DonorForm
              church={church}
              options={church.donationOptions ?? DONATION_FALLBACK_OPTIONS}
              activeGift={overview.activeGift}
              oneTime={oneTime}
              stripeReady={stripeReady}
            />
            <SupporterOverview
              churchName={church.churchName}
              neighbor={neighbor}
              overview={overview}
              returnPath={church.slug ? `/donate?church=${church.slug}` : '/donate'}
              stripeReady={stripeReady}
              userName={userName}
            />
          </div>
        ) : (
          // No beneficiary yet: the giver's own ledger would describe a church
          // they have not chosen, so the right column stays away until they pick.
          <DonorForm
            church={null}
            options={DONATION_FALLBACK_OPTIONS}
            activeGift={null}
            oneTime={oneTime}
            stripeReady={stripeReady}
          />
        )}
      </div>
    </BoxContainer>
  )
}
