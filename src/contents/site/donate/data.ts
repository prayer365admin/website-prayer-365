import { SiteMessageKey } from '@/i18n/messages'
import { DonationCategory } from '@/models/donation'
import { MobileDonationOptions } from '@/models/mobile'

/**
 * Pre-MB-03 churches have no `donation_options` row yet. These are UI defaults
 * documented in the WB-41 plan — fallbacks for the form, never presented as the
 * church's own configuration.
 */
export const DONATION_FALLBACK_OPTIONS: MobileDonationOptions = {
  currency: 'EUR',
  presetsMinor: [1000, 2500, 5000, 10000],
  monthlyEnabled: true,
}

/** Same enum the checkout API accepts, so a form choice can never drift from the server contract. */
export type DonationPurposeId = DonationCategory

export type DonationPurpose = {
  id: DonationPurposeId
  title: SiteMessageKey
  body: SiteMessageKey
}

/** W11 "Designate Ministry Purpose" 2×2 grid; the first one is the default. */
export const DONATION_PURPOSES: DonationPurpose[] = [
  {
    id: 'general',
    title: 'donatePurposeGeneralTitle',
    body: 'donatePurposeGeneralBody',
  },
  {
    id: 'pantry',
    title: 'donatePurposePantryTitle',
    body: 'donatePurposePantryBody',
  },
  {
    id: 'organ',
    title: 'donatePurposeOrganTitle',
    body: 'donatePurposeOrganBody',
  },
  {
    id: 'youth',
    title: 'donatePurposeYouthTitle',
    body: 'donatePurposeYouthBody',
  },
]

export const DONATION_PRESET_CAPTIONS: SiteMessageKey[] = [
  'donatePresetLocally',
  'donatePresetCare',
  'donatePresetMusic',
  'donatePresetPillar',
]

/** Money from minor units in the reader's locale; currencies are never summed together. */
export const formatMinor = (minor: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100)
