'use client'

import { QuoteIcon } from '@/components/icon/quote'
import { useSiteI18n } from '@/i18n/site-i18n'
import { HeartOutlined, ShareAltOutlined } from '@ant-design/icons'
import Image from 'next/image'
import { useState } from 'react'
import { prayerTextForDisplay } from '@/utils/rich-text-plain'

export type PrayerQuote = {
  id: string
  slug: string
  title: string
  body: string
  languageCode: string
  churchName: string
  churchCoverUrl: string | null
}

const FALLBACK_COVER_URL = '/images/viimsi-church-indoor.jpeg'

const quoteText = prayerTextForDisplay

const excerpt = (body: string) => {
  const source = quoteText(body)
  return source.length > 180 ? `${source.slice(0, 177).trimEnd()}…` : source
}

/** Church-cover quote column shared by Home (`home-1.png`) and the prayer archive featured card. */
export default function PrayerQuotePanel({
  prayer,
  showActions = true,
  showLoveAction = true,
}: {
  prayer: PrayerQuote | null
  showActions?: boolean
  showLoveAction?: boolean
}) {
  const { t } = useSiteI18n()
  const [shared, setShared] = useState(false)
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null)
  const churchCoverUrl = prayer?.churchCoverUrl
  const coverUrl =
    churchCoverUrl && churchCoverUrl !== failedCoverUrl ? churchCoverUrl : FALLBACK_COVER_URL

  const sharePrayer = async () => {
    if (!prayer) return
    const url = `${window.location.origin}/prayers/${prayer.slug}`
    try {
      if (navigator.share) {
        await navigator.share({ title: prayer.title, text: excerpt(prayer.body), url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShared(true)
      window.setTimeout(() => setShared(false), 1800)
    } catch {
      // A cancelled native share or denied clipboard permission leaves the page unchanged.
    }
  }

  return (
    <div className="relative min-h-[360px] overflow-hidden sm:min-h-[440px] lg:min-h-0">
      <Image
        alt={
          coverUrl === FALLBACK_COVER_URL ? 'Viimsi church interior' : `${prayer?.churchName} cover`
        }
        className="object-cover"
        fill
        onError={() => {
          if (churchCoverUrl) setFailedCoverUrl(churchCoverUrl)
        }}
        priority
        sizes="(min-width: 1024px) 42vw, 100vw"
        src={coverUrl}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,26,48,0.05)_0%,rgba(9,31,55,0.68)_58%,rgba(5,22,42,0.86)_100%)]" />

      <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-end p-5 text-white sm:min-h-[440px] sm:p-10 lg:p-8">
        {prayer ? (
          <>
            <span className="mb-5 inline-flex h-7 w-fit min-w-[164px] items-center gap-1.5 whitespace-nowrap rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur-[12px]">
              <Image alt="" aria-hidden height={11} src="/icons/icon-book.svg" width={14} />
              {t('homePrayerReflection')} · {prayer.languageCode.toUpperCase()}
            </span>
            <div className="flex min-w-0 gap-3">
              <QuoteIcon
                aria-hidden
                className="mt-1 shrink-0 self-start !text-white"
                style={{ fontSize: 20 }}
              />
              <blockquote
                className="line-clamp-5 min-w-0 flex-1 break-words font-font_quote text-[clamp(1.5rem,2.2vw,2rem)] italic leading-[1.25] text-white [overflow-wrap:anywhere]"
                title={quoteText(prayer.body)}
              >
                {quoteText(prayer.body)}
              </blockquote>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-white/75">
                {prayer.churchName}
              </p>
              {showActions && (
                <div className="flex gap-2">
                  <button
                    aria-label={shared ? t('homeLinkCopied') : t('homeSharePrayer')}
                    className="flex size-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30"
                    onClick={sharePrayer}
                    type="button"
                  >
                    <ShareAltOutlined />
                  </button>
                  {showLoveAction && (
                    <button
                      aria-label={t('homeSaveUnavailable')}
                      className="flex size-9 cursor-not-allowed items-center justify-center rounded-lg bg-white/20 opacity-60 backdrop-blur-sm"
                      disabled
                      title={t('homeSaveUnavailable')}
                      type="button"
                    >
                      <HeartOutlined />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <p className="font-font_quote text-4xl italic leading-tight">{t('homeQuietPlace')}</p>
            <p className="mt-5 text-sm text-white/80">{t('homeQuietPlaceBody')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
