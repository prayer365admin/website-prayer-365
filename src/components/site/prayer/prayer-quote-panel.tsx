'use client'

import { QuoteIcon } from '@/components/icon/quote'
import { useSiteI18n } from '@/i18n/site-i18n'
import { HeartOutlined, ShareAltOutlined } from '@ant-design/icons'
import Image from 'next/image'
import { useState } from 'react'

export type PrayerQuote = {
  id: string
  title: string
  body: string
  languageCode: string
  churchName: string
}

const excerpt = (body: string) => {
  const source = body.trim()
  return source.length > 210 ? `${source.slice(0, 207).trimEnd()}…` : source
}

/** Lake-image quote column shared by Home (`home-1.png`) and the prayer archive featured card. */
export default function PrayerQuotePanel({ prayer }: { prayer: PrayerQuote | null }) {
  const { t } = useSiteI18n()
  const [shared, setShared] = useState(false)

  const sharePrayer = async () => {
    if (!prayer) return
    const url = `${window.location.origin}/prayers/${prayer.id}`
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
        alt="Misty Nordic lake at sunrise"
        className="object-cover"
        fill
        priority
        sizes="(min-width: 1024px) 42vw, 100vw"
        src="/images/wb3-devotional-lake.png"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,26,48,0.05)_0%,rgba(9,31,55,0.68)_58%,rgba(5,22,42,0.86)_100%)]" />

      <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-end p-5 text-white sm:min-h-[440px] sm:p-10 lg:p-8">
        {prayer ? (
          <>
            <span className="mb-5 inline-flex h-7 w-fit min-w-[164px] items-center gap-1.5 whitespace-nowrap rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur-[12px]">
              <Image alt="" aria-hidden height={11} src="/icons/icon-book.svg" width={14} />
              {t('homePrayerReflection')} · {prayer.languageCode.toUpperCase()}
            </span>
            <div className="flex gap-3">
              <QuoteIcon
                aria-hidden
                className="mt-1 shrink-0 self-start !text-white"
                style={{ fontSize: 20 }}
              />
              <blockquote className="line-clamp-5 font-font_quote text-2xl italic leading-tight text-white md:text-[32px]">
                {prayer.body.trim()}
              </blockquote>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-white/75">
                {prayer.churchName}
              </p>
              <div className="flex gap-2">
                <button
                  aria-label={shared ? t('homeLinkCopied') : t('homeSharePrayer')}
                  className="flex size-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30"
                  onClick={sharePrayer}
                  type="button"
                >
                  <ShareAltOutlined />
                </button>
                <button
                  aria-label={t('homeSaveUnavailable')}
                  className="flex size-9 cursor-not-allowed items-center justify-center rounded-lg bg-white/20 opacity-60 backdrop-blur-sm"
                  disabled
                  title={t('homeSaveUnavailable')}
                  type="button"
                >
                  <HeartOutlined />
                </button>
              </div>
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
