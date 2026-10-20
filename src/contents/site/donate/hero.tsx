'use client'

import { HandHeartIcon } from '@/components/icon/hand-heart'
import { LockIcon } from '@/components/icon/lock'
import { PercentIcon } from '@/components/icon/percent'
import { ShieldCheckIcon } from '@/components/icon/shield-check'
import { useSiteI18n } from '@/i18n/site-i18n'
import { SiteMessageKey } from '@/i18n/messages'

const PILLARS: {
  id: string
  icon: typeof ShieldCheckIcon
  title: SiteMessageKey
  body: SiteMessageKey
}[] = [
  {
    id: 'fund',
    icon: ShieldCheckIcon,
    title: 'donatePillarFundTitle',
    body: 'donatePillarFundBody',
  },
  {
    id: 'private',
    icon: LockIcon,
    title: 'donatePillarPrivateTitle',
    body: 'donatePillarPrivateBody',
  },
  {
    id: 'tax',
    icon: PercentIcon,
    title: 'donatePillarTaxTitle',
    body: 'donatePillarTaxBody',
  },
]

/** W11 hero band: eyebrow, promise, scripture, and the three trust pillars. */
export function DonateHero() {
  const { t } = useSiteI18n()

  return (
    <section className="relative overflow-hidden rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full blur-[32px] sm:-right-20 sm:size-96"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(131,192,255,0.2) 0%, rgba(0,92,173,0.05) 100%)',
        }}
      />
      <div className="relative rounded-xl bg-primary-100 p-3.5 sm:p-5 md:p-6">
        <div className="mx-auto flex w-full max-w-[896px] flex-col gap-4">
          <div className="flex flex-col gap-2.5 sm:gap-3">
            <span className="inline-flex min-h-[26px] max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-medium leading-none text-blue-800 sm:px-4 sm:text-xs">
              <HandHeartIcon className="shrink-0" style={{ fontSize: 12, color: '#2F7AD2' }} />
              <span className="truncate">{t('donateEyebrow')}</span>
            </span>
            <h1 className="font-font_heading text-[22px] font-bold leading-7 tracking-[-0.5px] text-[#191C1E] sm:text-[28px] sm:leading-8 md:text-[32px] md:tracking-[-1px]">
              {t('donateTitle')}
            </h1>
            <div className="pt-2 sm:pt-4">
              <blockquote className="border-l-0 font-font_quote text-[19px] italic leading-snug text-[#2F7AD2] sm:text-2xl sm:leading-[1.2] md:text-[32px] md:leading-[1.15]">
                {t('donateScripture')}
              </blockquote>
              <p className="mt-2 sm:mt-3 text-[10px] font-semibold uppercase leading-[1.5] tracking-[1.5px] text-[#414752] sm:text-xs sm:tracking-[2px]">
                {t('donateScriptureRef')}
              </p>
            </div>
          </div>

          <div className="grid gap-3 pt-2 sm:gap-4 sm:pt-4 sm:grid-cols-3">
            {PILLARS.map(({ id, icon: Icon, title, body }) => (
              <div
                key={id}
                className="flex flex-col gap-2.5 rounded-lg bg-white p-3.5 sm:gap-3 sm:p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-200">
                  <Icon style={{ fontSize: 16, color: '#2F7AD2' }} />
                </span>
                <div className="py-0.5">
                  <h2 className="font-font_heading text-base font-semibold leading-[1.4] text-[#0E203E] sm:text-lg sm:leading-[1.5] md:text-xl">
                    {t(title)}
                  </h2>
                  <p className="text-xs leading-[1.5] text-[#5C6370]">{t(body)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
