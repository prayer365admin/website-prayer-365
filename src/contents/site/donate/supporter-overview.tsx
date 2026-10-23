'use client'

import { AngleRightIcon } from '@/components/icon/angle-right'
import { ArrowDownBracketIcon } from '@/components/icon/arrow-down-bracket'
import { CalendarClockIcon } from '@/components/icon/calendar-clock'
import { CreditCardIcon } from '@/components/icon/credit-card'
import { PauseCircleIcon } from '@/components/icon/pause-circle'
import { QuoteIcon } from '@/components/icon/quote'
import { ShieldCheckIcon } from '@/components/icon/shield-check'
import { SparklesIcon } from '@/components/icon/sparkles'
import { UserIcon } from '@/components/icon/user'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MyDonationOverview } from '@/models/donation'
import Image from 'next/image'
import { formatMinor } from './data'

const MONTHS_IN_YEAR = 12
const RING_RADIUS = 20
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const RING_SEGMENT = RING_CIRCUMFERENCE / MONTHS_IN_YEAR

/** The "months fulfilled" dial: 12 segments, the filled ones in brand blue. */
function SustainingRing({ filled }: { filled: number }) {
  return (
    <svg aria-hidden="true" className="shrink-0" height={56} viewBox="0 0 56 56" width={56}>
      <g transform="rotate(-90 28 28)">
        {Array.from({ length: MONTHS_IN_YEAR }, (_, index) => (
          <circle
            cx={28}
            cy={28}
            fill="none"
            key={index}
            r={RING_RADIUS}
            stroke={index < filled ? '#2F7AD2' : '#E6E8EA'}
            strokeDasharray={`${RING_SEGMENT * 0.7} ${RING_SEGMENT * 0.3}`}
            strokeDashoffset={-index * RING_SEGMENT}
            strokeLinecap="round"
            strokeWidth={6}
          />
        ))}
      </g>
    </svg>
  )
}

const MANAGEMENT_ICONS = [CreditCardIcon, PauseCircleIcon, ArrowDownBracketIcon]

// Hidden until the notification-preferences endpoint exists; flip to show the opt-in again.
const SHOW_ANNUAL_REPORT = false

/** W11 right column: the giver's own ledger, the annual report opt-in (hidden), and the impact story. */
export function SupporterOverview({
  overview,
  churchName,
  userName,
}: {
  overview: MyDonationOverview
  churchName: string
  userName: string | null
}) {
  const { locale, t } = useSiteI18n()
  const { activeGift, contributions, nextGiftAt, year } = overview
  // Never add currencies together: one currency is reported at a time.
  const primary =
    contributions.find((row) => row.currency === activeGift?.currency) ?? contributions[0] ?? null
  const monthsFulfilled = primary?.months.length ?? 0
  const management = [
    {
      id: 'card',
      label: 'donateManageCard',
      tone: 'text-[#0E203E]',
      Icon: MANAGEMENT_ICONS[0],
      TrailingIcon: AngleRightIcon,
      trailingStyle: { fontSize: 14, color: '#8F96A3' },
    },
    {
      id: 'pause',
      label: 'donateManagePause',
      tone: 'text-[#0E203E]',
      Icon: MANAGEMENT_ICONS[1],
      TrailingIcon: AngleRightIcon,
      trailingStyle: { fontSize: 14, color: '#8F96A3' },
    },
    {
      id: 'certificate',
      label: 'donateManageCertificate',
      tone: 'text-[#2F7AD2]',
      Icon: MANAGEMENT_ICONS[2],
      TrailingIcon: ArrowDownBracketIcon,
      trailingStyle: { fontSize: 16, color: '#2F7AD2' },
    },
  ] as const

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
              <p className="text-xs font-semibold leading-[1.5] text-[#2F7AD2]">
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

          <div className="flex items-center gap-4 rounded-xl bg-[#FAFAFB] p-4">
            <SustainingRing filled={monthsFulfilled} />
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-[1.5] text-[#2F7AD2]">
                {monthsFulfilled}/{MONTHS_IN_YEAR}
              </p>
              <p className="text-sm font-semibold leading-[1.5] text-[#0E203E]">
                {t('donateSustainingGoal', { year })}
              </p>
              <p className="text-xs leading-[1.5] text-[#5C6370]">
                {t('donateSustainingGoalBody', { months: monthsFulfilled })}
              </p>
            </div>
          </div>
        </div>

        {/* Management needs the provider-side card portal; until it exists these
            rows stay visible but inert rather than faking a destination. */}
        <div
          aria-disabled="true"
          className="flex flex-col gap-2 border-t border-neutral-200 p-4"
          title={t('donateComingSoon')}
        >
          {management.map(({ id, label, tone, Icon, TrailingIcon, trailingStyle }) => (
            <span
              className="flex h-[37px] items-center justify-between gap-2 rounded-lg p-2 text-sm font-semibold leading-[1.5]"
              key={id}
            >
              <span className={`inline-flex items-center gap-2 ${tone}`}>
                <Icon style={{ fontSize: 16, color: '#2F7AD2' }} />
                {t(label)}
              </span>
              <TrailingIcon style={trailingStyle} />
            </span>
          ))}
        </div>
      </section>

      {SHOW_ANNUAL_REPORT && (
        <section
          aria-labelledby="donate-report-title"
          className="min-w-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
        >
          <div className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <h2
                className="font-font_heading text-xl font-semibold leading-[1.5] text-[#0E203E]"
                id="donate-report-title"
              >
                {t('donateAnnualReportTitle')}
              </h2>
              <p className="text-xs leading-[1.5] text-[#5C6370]">{t('donateAnnualReportBody')}</p>
            </div>
            {/* Visual only: the notification-preferences endpoint does not exist yet. */}
            <span
              aria-hidden="true"
              className="flex h-8 w-14 shrink-0 items-center justify-end rounded-full bg-[#2F7AD2] p-[3px]"
              title={t('donateComingSoon')}
            >
              <span className="size-[26px] rounded-full bg-white" />
            </span>
          </div>
          <div className="p-4 pt-0">
            <div className="flex items-center gap-4 rounded-xl bg-gradient-to-br from-[rgba(194,217,255,0.4)] to-transparent bg-white p-4 shadow-[-1px_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)]">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#D0E4FF]">
                <ShieldCheckIcon style={{ fontSize: 16, color: '#2F7AD2' }} />
              </span>
              <p className="text-xs leading-[1.5] text-[#5C6370]">{t('donateTrustBody')}</p>
            </div>
          </div>
        </section>
      )}

      <section
        aria-labelledby="donate-spotlight-title"
        className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      >
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#B9D8F8] px-4 py-1 text-xs leading-[1.5] text-[#0B4497]">
          <SparklesIcon style={{ fontSize: 12, color: '#0B4497' }} />
          {t('donateSpotlightPill')}
        </span>
        <div className="relative h-[176px] w-full overflow-hidden rounded-lg">
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 430px, 100vw"
            src="/images/st-johns-church.jpeg"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to top, rgba(45,49,51,0.8) 0%, rgba(45,49,51,0) 50%, rgba(45,49,51,0) 100%)',
            }}
          />
          <span className="absolute bottom-2 left-2 right-2 text-xs leading-[1.5] text-white">
            {t('donateSpotlightCaption')}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2
            className="font-font_heading text-xl font-semibold leading-[1.5] text-[#0E203E]"
            id="donate-spotlight-title"
          >
            {t('donateSpotlightTitle')}
          </h2>
          <p className="text-sm leading-[1.5] text-[#5C6370]">{t('donateSpotlightBody')}</p>
        </div>
        <figure className="rounded-lg bg-[#F2F4F6] p-4">
          <QuoteIcon aria-hidden style={{ fontSize: 16, color: '#2F7AD2' }} />
          <blockquote className="mt-1 font-font_quote text-[32px] italic leading-[1.15] text-[#0B4497]">
            {t('donatePastorQuote')}
          </blockquote>
          <figcaption className="mt-1">
            <span className="block text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#5C6370]">
              {t('donatePastorName')}
            </span>
            <span className="block text-xs font-medium leading-4 text-[#414752]">
              {t('donatePastorRole')}
            </span>
          </figcaption>
        </figure>
      </section>
    </div>
  )
}
