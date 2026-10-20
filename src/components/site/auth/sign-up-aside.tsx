import { ChurchIcon } from '@/components/icon/church'
import { GuardIcon } from '@/components/icon/guard'
import { LocationIcon } from '@/components/icon/location'
import { SanctuaryIcon } from '@/components/icon/sanctuary'
import { VerifyIcon } from '@/components/icon/verify'
import { SiteT } from '@/i18n/messages'
import { RegionalSanctuaryStats } from '@/models/regional-sanctuary-stats'
import { SiteLocale } from '@/config/site-locale'
import Image from 'next/image'
import { ReactNode } from 'react'
import Pill from './pill'
import ScriptureQuote from './scripture-quote'

/*
 * Sign-up side panels (WB1 design). Public network totals are queried from the
 * current database by the registration page. Unsupported activity estimates
 * are intentionally not shown.
 *
 * Server component (no client JS): the page passes `t` from siteT(locale).
 */

const Stat = ({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
}) => (
  <div className="rounded-xl bg-gray-100 p-3">
    <p className="text-xs text-primary-950">{label}</p>
    <p className="text-2xl font-semibold text-primary-950">{value}</p>
    <p className="mt-3 flex items-center gap-1.5 text-xs text-primary-500">
      {icon}
      {hint}
    </p>
  </div>
)

export default function SignUpAside({
  locale = 'en',
  stats = null,
  t,
}: {
  locale?: SiteLocale
  stats?: RegionalSanctuaryStats | null
  t: SiteT
}) {
  const number = new Intl.NumberFormat(locale)

  return (
    <>
      <section className="flex flex-col items-center rounded-xl bg-gradient-to-b from-blue-50 to-white p-4 text-center shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
        <Image alt="" className="rounded-2xl py-4" height={80} src="/images/icon.jpg" width={80} />
        <Pill icon={<VerifyIcon className="!text-primary-500" aria-hidden />}>
          {t('journeyPill')}
        </Pill>
        <h2 className="mt-2 font-font_heading text-2xl font-semibold text-primary-950">
          {t('journeyTitle')}
        </h2>
        <p className="mt-3 text-neutral-600">{t('journeyBody')}</p>
        <ScriptureQuote
          className="mt-6 w-full !p-4 text-left !bg-blue-100 !text-[32px]"
          quote={t('signUpQuote')}
          reference={t('signUpQuoteRef')}
        />
      </section>

      <section className="rounded-xl bg-white p-4 shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-medium text-sm text-primary-950">
            <SanctuaryIcon aria-hidden className="!text-primary-500" style={{ fontSize: 24 }} />
            {t('sanctuariesTitle')}
          </h3>
          {stats && (
            <span className="text-xs text-primary-500">
              {t('sanctuariesCount', { count: number.format(stats.approvedChurches) })}
            </span>
          )}
        </div>
        {stats && (
          <div className="mt-4">
            <Stat
              hint={t('diocesesHint')}
              icon={<LocationIcon aria-hidden />}
              label={t('diocesesLabel')}
              value={number.format(stats.dioceses)}
            />
          </div>
        )}
        <figure className="relative mt-4 h-32 overflow-hidden rounded-xl">
          <Image
            alt={t('photoCaption')}
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 440px, 100vw"
            src="/images/sign-up-banner.jpg"
          />
          <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-xs text-white">
            <ChurchIcon aria-hidden className="!text-white" />
            {t('photoCaption')}
          </figcaption>
        </figure>
      </section>

      <section className="relative isolate flex gap-3 overflow-hidden rounded-2xl bg-primary-100 p-4 shadow-[0px_1px_2px_0px_#0000000D,-1px_-1px_2px_0px_#FFFFFF]">
        <GuardIcon
          aria-hidden
          className="shrink-0 !text-primary-500 !flex !items-start"
          style={{ fontSize: 20 }}
        />
        <p className="text-xs text-neutral-600">{t('privacyNote')}</p>
        {/* Soft blue-200 glow fading in from the left (WB1 design). filter blur, not
            backdrop-filter: the glow blurs itself, nothing sits behind it. */}
        <div
          aria-hidden
          className="absolute -left-2 top-1/2 -z-10 h-[95px] w-[95px] -translate-y-1/2 rounded-full bg-blue-200 blur-[28px]"
        />
      </section>
    </>
  )
}
