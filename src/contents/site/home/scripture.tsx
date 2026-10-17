'use client'

import { useSiteI18n } from '@/i18n/site-i18n'
import { HeartOutlined, ShareAltOutlined } from '@ant-design/icons'

const iconButton =
  'flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-primary-900'

/** Home section 3, left 3 (`home-3-left-3.png`): static scripture of the day. */
export default function ScriptureOfDay() {
  const { t } = useSiteI18n()
  const text = t('homeScriptureText')
  const reference = t('homeScriptureReference')

  const share = async () => {
    const quote = `“${text}” — ${reference}`
    try {
      if (navigator.share) await navigator.share({ text: quote })
      else await navigator.clipboard.writeText(quote)
    } catch {
      // Cancelled share or denied clipboard: nothing to undo.
    }
  }

  return (
    <section className="rounded-2xl p-4 shadow-[0_1px_2px_0_#0000000D,-1px_-1px_2px_0_#FFFFFF] sm:h-[259px] bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)]">
      <figure
        className="flex h-full flex-col gap-4 p-4"
        style={{ background: 'var(--Colors-Primary-100, #F5F7FF)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-900">
            {t('homeScriptureLabel')}
          </h2>
          <div className="flex gap-2">
            <button
              aria-label={t('homeShareScripture')}
              className={iconButton}
              onClick={share}
              type="button"
            >
              <ShareAltOutlined />
            </button>
            <button
              aria-label={t('homeSaveUnavailable')}
              className={`${iconButton} cursor-not-allowed`}
              disabled
              title={t('homeSaveUnavailable')}
              type="button"
            >
              <HeartOutlined />
            </button>
          </div>
        </div>
        <blockquote className="font-font_quote text-2xl font-normal italic leading-[1.15] tracking-normal text-blue-800 sm:text-[32px]">
          “{text}”
        </blockquote>
        <figcaption className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
            {reference}
          </span>
          <span className="text-xs text-neutral-400">{t('homeScriptureReflected')}</span>
        </figcaption>
      </figure>
    </section>
  )
}
