'use client'

import { AngleRightIcon } from '@/components/icon/angle-right'
import { CalendarClockIcon } from '@/components/icon/calendar-clock'
import { PauseCircleIcon } from '@/components/icon/pause-circle'
import { UserIcon } from '@/components/icon/user'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useOpenBillingPortal } from '@/hooks/data/site/donation'
import { redirectExternal } from '@/utils/redirect-external'
import { DonateNeighborSpotlight, MyDonationOverview } from '@/models/donation'
import { useState } from 'react'
import { formatMinor } from './data'
import { NeighborSpotlight } from './neighbor-spotlight'

/** W11 right column: the giver's own stewardship and a neighbouring parish spotlight. */
export function SupporterOverview({
  overview,
  churchName,
  userName,
  stripeReady,
  returnPath,
  neighbor,
}: {
  overview: MyDonationOverview
  churchName: string
  userName: string | null
  stripeReady: boolean
  /** Where Stripe sends the giver back after they manage their pledge. */
  returnPath: string
  /** Nearest other parish that has published a prayer, or null. */
  neighbor: DonateNeighborSpotlight | null
}) {
  const { locale, t } = useSiteI18n()
  const { activeGift, contributions, nextGiftAt, year } = overview
  const { onOpenPortal, opening } = useOpenBillingPortal()
  const [portalError, setPortalError] = useState<string | null>(null)
  // Never add currencies together: one currency is reported at a time.
  const primary =
    contributions.find((row) => row.currency === activeGift?.currency) ?? contributions[0] ?? null
  // Pausing is a Stripe-side action: without an active pledge there is nothing to
  // manage, and without a live integration there is nowhere honest to send them.
  const canManagePledge = Boolean(activeGift) && stripeReady

  const openBillingPortal = async () => {
    setPortalError(null)
    try {
      const { url } = await onOpenPortal({ returnPath })
      redirectExternal(url)
    } catch {
      setPortalError(t('donateManagePortalFailed'))
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section
        aria-labelledby="donate-summary-title"
        className="min-w-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      >
        <div className="flex items-center gap-2 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#E6EDFB]">
            <UserIcon style={{ fontSize: 16, color: '#2F7AD2' }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="truncate font-font_heading text-xl font-semibold leading-[1.5] text-[#0E203E]"
              id="donate-summary-title"
            >
              {userName ?? t('donateYourStewardship')}
            </h2>
            <p className="truncate text-xs leading-[1.5] text-[#0B4497]">{churchName}</p>
          </div>
          {activeGift && (
            <span className="inline-flex items-center rounded-full bg-[#B9D8F8] px-2.5 py-1 text-xs leading-[1.5] text-[#2F7AD2]">
              {t('donateActivePatron')}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4 p-4 pt-0">
          <div className="flex gap-4 pt-1">
            <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg bg-[#FAFAFB] p-3.5">
              <span className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#737C8C]">
                {t('donateMonthlyPledge')}
              </span>
              <p className="flex items-baseline gap-1">
                <span className="font-font_heading text-2xl font-semibold leading-6 tracking-[-1px] text-[#2F7AD2]">
                  {activeGift
                    ? formatMinor(activeGift.amountMinor, activeGift.currency, locale)
                    : '—'}
                </span>
                {activeGift && (
                  <span className="text-xs leading-[1.5] text-[#414752]">
                    {t('donatePerMonthShort')}
                  </span>
                )}
              </p>
              <p className="truncate text-xs font-semibold leading-[1.5] text-[#2F7AD2]">
                {activeGift
                  ? t('donateParishFund', { church: activeGift.churchName })
                  : t('donateNoPledge')}
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg bg-[#FAFAFB] p-3.5">
              <span className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#737C8C]">
                {t('donateContributions', { year })}
              </span>
              <p className="flex items-baseline gap-1">
                <span className="font-font_heading text-2xl font-semibold leading-6 tracking-[-1px] text-[#0E203E]">
                  {primary ? formatMinor(primary.totalMinor, primary.currency, locale) : '—'}
                </span>
                <span className="text-xs leading-[1.5] text-[#414752]">{t('donateTotal')}</span>
              </p>
              <p className="truncate text-xs font-semibold leading-[1.5] text-[#22252A]">
                {t('donateSuccessfulTithes', { count: primary?.count ?? 0 })}
              </p>
            </div>
          </div>

          {nextGiftAt && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FAFAFB] p-3">
              <span className="inline-flex items-center gap-2 text-xs leading-[1.5] text-[#5C6370]">
                <CalendarClockIcon style={{ fontSize: 16, color: '#2F7AD2' }} />
                {t('donateNextGift')}
              </span>
              <span className="text-xs font-semibold leading-[1.5] text-[#0E203E]">
                {new Intl.DateTimeFormat(locale, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(nextGiftAt)}
              </span>
            </div>
          )}
        </div>

        {(canManagePledge || portalError) && (
          <div className="flex flex-col gap-2 border-t border-neutral-200 p-4">
            {canManagePledge && (
              <button
                className="flex h-[37px] w-full items-center justify-between gap-2 rounded-lg p-2 text-sm font-semibold leading-[1.5] transition-colors hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
                disabled={opening}
                onClick={openBillingPortal}
                type="button"
              >
                <span className="inline-flex items-center gap-2 text-[#0E203E]">
                  <PauseCircleIcon style={{ fontSize: 16, color: '#2F7AD2' }} />
                  {t('donateManagePause')}
                </span>
                <AngleRightIcon style={{ fontSize: 14, color: '#8F96A3' }} />
              </button>
            )}
            {portalError && (
              <p aria-live="polite" className="text-xs leading-[1.5] text-danger-700">
                {portalError}
              </p>
            )}
          </div>
        )}
      </section>

      {neighbor && <NeighborSpotlight neighbor={neighbor} />}
    </div>
  )
}
