'use client'

import { formatMinor } from '@/contents/site/donate/data'
import { useSiteI18n } from '@/i18n/site-i18n'
import { CheckCircleFilled } from '@ant-design/icons'
import Link from 'next/link'

/**
 * The settled-gift card, shared by both branches of `/donate/result`. A parish giver
 * and a guest see the same receipt layout — parish, amount, frequency, next steps —
 * because it is the same page reading two ledgers, not two designs.
 */
export default function DonationConfirmedCard({
  title,
  body,
  churchName,
  amountMinor,
  currency,
  frequency,
  nextStepsBody,
  onWatchVideo,
  backHref,
}: {
  title: string
  body: string
  churchName: string
  /** `null` until the webhook writes the row: the card must not invent a sum. */
  amountMinor: number | null
  currency: string
  frequency: 'one_time' | 'monthly'
  nextStepsBody: string
  onWatchVideo: () => void
  backHref: string
}) {
  const { locale, t } = useSiteI18n()

  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <CheckCircleFilled aria-hidden className="text-success-500" style={{ fontSize: 40 }} />
      <h1
        aria-live="polite"
        className="font-font_heading text-2xl font-semibold leading-8 text-primary-900"
      >
        {title}
      </h1>
      <p className="max-w-[520px] text-sm leading-[1.5] text-neutral-600">{body}</p>

      <dl className="mt-2 grid w-full gap-3 rounded-xl bg-neutral-100 p-4 text-left sm:grid-cols-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#737C8C]">
            {t('donateResultChurch')}
          </dt>
          <dd className="text-sm font-semibold leading-[1.5] text-primary-900">{churchName}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#737C8C]">
            {t('donateResultAmount')}
          </dt>
          <dd className="text-sm font-semibold leading-[1.5] text-primary-900">
            {amountMinor === null ? '—' : formatMinor(amountMinor, currency, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#737C8C]">
            {t('donateResultFrequency')}
          </dt>
          <dd className="text-sm font-semibold leading-[1.5] text-primary-900">
            {t(
              frequency === 'monthly'
                ? 'donateResultFrequencyMonthly'
                : 'donateResultFrequencyOnce',
            )}
          </dd>
        </div>
      </dl>

      <div className="w-full rounded-xl bg-primary-100 p-4 text-left">
        <h2 className="text-sm font-semibold leading-[1.5] text-primary-900">
          {t('donateResultNextSteps')}
        </h2>
        <p className="text-xs leading-[1.5] text-neutral-600">{nextStepsBody}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        <button
          className="text-sm font-semibold text-primary-600 underline-offset-2 hover:underline hover:text-primary-700"
          onClick={onWatchVideo}
          type="button"
        >
          {t('donateResultWatchVideo')}
        </button>
        <Link
          className="text-sm font-semibold text-blue-800 underline-offset-2 hover:underline"
          href={backHref}
        >
          {t('donateResultBack')}
        </Link>
      </div>
    </section>
  )
}
