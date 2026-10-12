'use client'

import { ChurchIcon } from '@/components/icon/church'
import { GuardIcon } from '@/components/icon/guard'
import { IntercedingIcon } from '@/components/icon/interceding'
import { LocationIcon } from '@/components/icon/location'
import { SanctuaryIcon } from '@/components/icon/sanctuary'
import { VerifyIcon } from '@/components/icon/verify'
import { useSiteI18n } from '@/i18n/site-i18n'
import Image from 'next/image'
import { ReactNode } from 'react'
import Pill from './pill'
import ScriptureQuote from './scripture-quote'

/*
 * Sign-up side panels (WB1 design). Stats are HARDCODED for now (decision F2,
 * REPORT R-05); they are not live counts.
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
  <div className="rounded-xl bg-[#f3f6fa] p-3">
    <p className="text-sm text-accent_color_1">{label}</p>
    <p className="text-2xl font-semibold text-accent_color_1">{value}</p>
    <p className="mt-3 flex items-center gap-1.5 text-sm text-primary_color">
      {icon}
      {hint}
    </p>
  </div>
)

export default function SignUpAside() {
  const { t } = useSiteI18n()

  return (
    <>
      <section className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-[#e8f0fb] to-white p-4 text-center shadow-[0_8px_30px_rgba(15,40,80,0.06)] md:p-6">
        <Image alt="" className="rounded-2xl" height={80} src="/images/icon.jpg" width={80} />
        <Pill className="mt-6" icon={<VerifyIcon aria-hidden />}>
          {t('journeyPill')}
        </Pill>
        <h2 className="mt-2 font-font_heading text-2xl font-semibold text-accent_color_1">
          {t('journeyTitle')}
        </h2>
        <p className="mt-3 text-gray-600">{t('journeyBody')}</p>
        <ScriptureQuote
          className="mt-6 w-full text-left"
          quote={t('signUpQuote')}
          reference={t('signUpQuoteRef')}
        />
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-medium text-accent_color_1">
            <SanctuaryIcon aria-hidden style={{ fontSize: 24, color: '#2F7AD2' }} />
            {t('sanctuariesTitle')}
          </h3>
          <span className="text-sm text-primary_color">{t('sanctuariesCount')}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat
            hint={t('vespersHint')}
            icon={<IntercedingIcon aria-hidden />}
            label={t('vespersLabel')}
            value={t('vespersValue')}
          />
          <Stat
            hint={t('diocesesHint')}
            icon={<LocationIcon aria-hidden />}
            label={t('diocesesLabel')}
            value={t('diocesesValue')}
          />
        </div>
        <figure className="relative mt-4 h-32 overflow-hidden rounded-xl">
          <Image
            alt={t('photoCaption')}
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 440px, 100vw"
            src="/images/sign-up-banner.jpg"
          />
          <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-sm text-white">
            <ChurchIcon aria-hidden />
            {t('photoCaption')}
          </figcaption>
        </figure>
      </section>

      <section className="flex gap-3 rounded-2xl bg-secondary_color/20 p-4 text-sm text-accent_color_1">
        <GuardIcon aria-hidden style={{ fontSize: 18, color: '#2F7AD2' }} className="shrink-0" />
        <p>{t('privacyNote')}</p>
      </section>
    </>
  )
}
