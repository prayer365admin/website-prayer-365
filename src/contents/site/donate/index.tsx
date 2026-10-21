'use client'

import BoxContainer from '@/components/container/boxed'
import { MyDonationOverview } from '@/models/donation'
import { MobileDonationOptions } from '@/models/mobile'
import { DonateHero } from './hero'
import { DonorForm } from './donor-form'
import { DONATION_FALLBACK_OPTIONS } from './data'
import { SupporterOverview } from './supporter-overview'
import { DonateTransparency } from './transparency'

/** W11 Giving & Stewardship Portal (WB-41). Server page supplies the church, the giver's own ledger and the flag. */
export default function ContentsSiteDonate({
  churchId,
  churchName,
  isMainParish,
  donationOptions,
  overview,
  userName,
  stripeReady,
  oneTime = false,
}: {
  churchId: string
  churchName: string
  isMainParish: boolean
  donationOptions?: MobileDonationOptions
  overview: MyDonationOverview
  userName: string | null
  stripeReady: boolean
  /** Start the form on a one-time gift instead of the church's monthly default. */
  oneTime?: boolean
}) {
  return (
    <BoxContainer containerClassName="py-8">
      <div className="flex min-w-0 flex-col gap-10">
        <DonateHero />
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,658.67fr)_minmax(0,461.33fr)]">
          <DonorForm
            churchId={churchId}
            churchName={churchName}
            isMainParish={isMainParish}
            options={donationOptions ?? DONATION_FALLBACK_OPTIONS}
            activeGift={overview.activeGift}
            oneTime={oneTime}
            stripeReady={stripeReady}
          />
          <SupporterOverview churchName={churchName} overview={overview} userName={userName} />
        </div>
        <DonateTransparency />
      </div>
    </BoxContainer>
  )
}
