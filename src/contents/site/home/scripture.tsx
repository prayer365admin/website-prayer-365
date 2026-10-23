'use client'

import { useSiteI18n } from '@/i18n/site-i18n'
import { MobilePublishedPrayer } from '@/models/mobile'
import { prayerTextForDisplay } from '@/utils/rich-text-plain'

/** Home section 3, left 3: reflection sourced from today's latest published prayer. */
export default function ScriptureOfDay({ prayer }: { prayer?: MobilePublishedPrayer }) {
  const { t } = useSiteI18n()
  const prayerText = prayer ? prayerTextForDisplay(prayer.version.body) : ''
  const text = prayerText || t('homeScriptureText')
  const reference = prayer
    ? prayerTextForDisplay(prayer.version.title)
    : t('homeScriptureReference')

  return (
    <section className="rounded-2xl p-4 shadow-[0_1px_2px_0_#0000000D,-1px_-1px_2px_0_#FFFFFF] sm:h-[259px] bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)]">
      <figure
        className="flex h-full flex-col gap-4 p-4"
        style={{ background: 'var(--Colors-Primary-100, #F5F7FF)' }}
      >
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-900">
          {t('homeScriptureLabel')}
        </h2>
        <blockquote
          className="line-clamp-3 break-words font-font_quote text-2xl font-normal italic leading-[1.15] tracking-normal text-blue-800 [overflow-wrap:anywhere] sm:text-[32px]"
          title={text}
        >
          “{text}”
        </blockquote>
        <figcaption className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
            {reference}
          </span>
          {prayer && (
            <span className="text-xs text-neutral-400">
              {prayer.version.pastorName} · {prayer.churchName}
            </span>
          )}
        </figcaption>
      </figure>
    </section>
  )
}
