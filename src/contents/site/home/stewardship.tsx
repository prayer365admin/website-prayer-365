'use client'

import { QuoteIcon } from '@/components/icon/quote'
import MaskIcon from '@/components/site/mask-icon'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MyActiveGift } from '@/models/donation'
import { ExportOutlined } from '@ant-design/icons'
import { homeCardThinShadowClassName } from './data'

/** Home section 3, right 3 (`home-3-right-3.png`): the customer's own active monthly gift. */
export function Stewardship({ gift }: { gift: MyActiveGift | null }) {
  const { locale, t } = useSiteI18n()

  return (
    <section aria-labelledby="home-stewardship-title" className={homeCardThinShadowClassName}>
      <div className="flex items-center gap-3 border-b border-neutral-200 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <MaskIcon className="bg-primary-500" size={20} src="/icons/icon-prayer-love.svg" />
        </span>
        <h2
          className="flex-1 text-xl font-semibold leading-[1.5] tracking-normal text-primary-900"
          id="home-stewardship-title"
        >
          {t('homeStewardshipTitle')}
        </h2>
        {gift && (
          <span className="rounded-full bg-primary-300/40 px-2.5 py-0.5 text-xs text-blue-800">
            {t('homeStewardshipActive')}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="rounded-xl bg-neutral-50 p-3">
          {gift ? (
            <>
              <p className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-blue-800">
                  {new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: gift.currency,
                    minimumFractionDigits: gift.amountMinor % 100 ? 2 : 0,
                  }).format(gift.amountMinor / 100)}
                </span>
                <span className="text-xs text-neutral-500">{t('homeStewardshipPerMonth')}</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                {t('homeStewardshipBeneficiary', { church: gift.churchName })}
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-600">{t('homeStewardshipNone')}</p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3" title={t('homeComingSoon')}>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-primary-500">
            {t('homeStewardshipManage')} <ExportOutlined />
          </span>
          <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold leading-[1.5] tracking-normal text-[#2555A7]">
            {t('homeStewardshipOneTime')}
          </span>
        </div>
      </div>
    </section>
  )
}

/** Home section 3, right 4 (`home-3-right-4.png`): brand quote. */
export function BrandQuote() {
  const { t } = useSiteI18n()
  return (
    <figure className="rounded-2xl bg-[radial-gradient(circle_at_80%_20%,#2b6c8c_0%,transparent_45%),radial-gradient(circle_at_20%_90%,#1d4f9a_0%,transparent_50%),linear-gradient(135deg,#0b3a8c_0%,#0a2a6b_100%)] px-6 py-10 text-center text-white shadow-[0_12px_36px_rgba(11,58,140,0.25)]">
      <QuoteIcon aria-hidden className="!text-white" style={{ fontSize: 16 }} />
      <blockquote className="mt-3 text-center font-font_quote text-[32px] font-normal italic leading-[1.15] tracking-normal">
        {t('homeBrandQuote')}
      </blockquote>
      <figcaption className="mt-3 font-font_heading text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-white/70">
        {t('homeBrandSignature')}
      </figcaption>
    </figure>
  )
}
