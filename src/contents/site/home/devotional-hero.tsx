'use client'

import { QuoteIcon } from '@/components/icon/quote'
import DevotionalAudioPlayer from '@/components/site/prayer/devotional-audio-player'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobilePublishedPrayer } from '@/models/mobile'
import { HeartOutlined, ShareAltOutlined, StarFilled } from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || 'friend'

const excerpt = (prayer: MobilePublishedPrayer) => {
  const source = prayer.version.body.trim()
  return source.length > 210 ? `${source.slice(0, 207).trimEnd()}…` : source
}

/** Home section 1 (`home-1.png`): greeting, newest guided prayer, and scripture-style quote panel. */
export default function DevotionalHero({
  prayer,
  name,
  now,
}: {
  prayer?: MobilePublishedPrayer
  name?: string | null
  now: string
}) {
  const { locale, t } = useSiteI18n()
  const [shared, setShared] = useState(false)
  const date = new Date(now)
  const hour = date.getUTCHours()
  const greeting =
    hour < 12 ? t('homeGoodMorning') : hour < 18 ? t('homeGoodAfternoon') : t('homeGoodEvening')
  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)

  const sharePrayer = async () => {
    if (!prayer) return
    const url = `${window.location.origin}/prayers/${prayer.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: prayer.version.title, text: excerpt(prayer), url })
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
    <section
      aria-labelledby="home-devotional-title"
      className="grid overflow-hidden rounded-3xl bg-white sm:rounded-[28px] shadow-[0_18px_50px_rgba(24,74,140,0.10)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:grid-cols-[minmax(0,672px)_minmax(0,480px)]"
    >
      <div className="bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)] p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs font-medium text-blue-800">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-blue-800 sm:px-4 sm:py-2 shadow-sm">
            <StarFilled className="text-primary-500" /> {t('homeLiturgicalFocus')}
          </span>
          <time className="text-blue-800" dateTime={date.toISOString()}>
            {formattedDate}
          </time>
        </div>

        <h1
          className="mt-4 font-font_heading text-[26px] font-bold leading-tight sm:text-[32px] tracking-[-0.035em] text-primary-900"
          id="home-devotional-title"
        >
          {greeting}, {firstName(name)}.{' '}
          <span className="font-font_quote font-normal italic text-primary-700">
            {t('homeNotAlone')}
          </span>
        </h1>
        <p className="mt-2 max-w-[620px] text-sm leading-6 text-neutral-600 sm:text-base">
          {t('homeWelcomeBody')}
        </p>

        {prayer ? (
          <article className="mt-6 rounded-[20px] sm:mt-8 bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)] p-4 sm:p-6 shadow-[0_1px_2px_0_rgba(0,0,0,0.05),-1px_-1px_2px_0_#FFFFFF]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-500 sm:tracking-[0.22em]">
                  <Image alt="" aria-hidden height={14} src="/icons/Icon-sound.svg" width={14} />{' '}
                  {t('homeGuidedContemplation')}
                </p>
                <h2 className="mt-1 text-xl font-semibold sm:text-2xl tracking-[-0.035em] text-primary-900">
                  {prayer.version.title}
                </h2>
                <p className="mt-1 text-xs text-neutral-600 sm:text-sm">
                  {prayer.version.introduction || t('homeDailyPrayer')} · {prayer.churchName}
                </p>
              </div>
              <button
                aria-label={t('homeSaveUnavailable')}
                className="flex size-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-neutral-200 bg-white text-primary-700 opacity-60"
                disabled
                title={t('homeSaveUnavailable')}
                type="button"
              >
                <Image alt="" aria-hidden height={15} src="/icons/icon-bookmark.svg" width={11} />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full bg-primary-700 text-sm font-semibold text-white"
              >
                {prayer.version.pastorName.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold text-primary-900">
                  {prayer.version.pastorName}
                </p>
                <p className="text-xs text-neutral-600">{prayer.churchName}</p>
              </div>
            </div>

            {prayer.audio?.url ? (
              <DevotionalAudioPlayer prayerId={prayer.id} src={prayer.audio.url} />
            ) : (
              <Link
                className="mt-6 inline-flex rounded-full border border-primary-300 bg-white px-5 py-2.5 text-sm font-semibold text-primary-700"
                href={`/prayers/${prayer.id}`}
              >
                {t('homeReadPrayer')}
              </Link>
            )}
          </article>
        ) : (
          <div className="mt-8 rounded-[20px] border border-white bg-white/70 px-6 py-8">
            <h2 className="text-xl font-semibold text-primary-900">{t('homeEmptyTitle')}</h2>
            <p className="mt-2 text-neutral-600">{t('homeEmptyBody')}</p>
            <Link
              className="mt-5 inline-flex rounded-full bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white"
              href="/churches"
            >
              {t('homeGoDirectory')}
            </Link>
          </div>
        )}
      </div>

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
                {t('homePrayerReflection')} · {prayer.version.languageCode.toUpperCase()}
              </span>
              <div className="flex gap-3">
                <QuoteIcon
                  aria-hidden
                  className="mt-1 shrink-0 self-start !text-white"
                  style={{ fontSize: 20 }}
                />
                <blockquote className="line-clamp-5 font-font_quote text-2xl italic leading-tight text-white md:text-[32px]">
                  {prayer.version.body.trim()}
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
    </section>
  )
}
