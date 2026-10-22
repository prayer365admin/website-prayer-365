'use client'

import MaskIcon from '@/components/site/mask-icon'
import DevotionalAudioPlayer from '@/components/site/prayer/devotional-audio-player'
import PrayerQuotePanel from '@/components/site/prayer/prayer-quote-panel'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobilePublishedPrayer } from '@/models/mobile'
import Image from 'next/image'
import Link from 'next/link'

const firstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || 'friend'

/** Home section 1 (`home-1.png`): greeting, newest guided prayer, and scripture-style quote panel. */
export default function DevotionalHero({
  prayer,
  name,
  now,
  userId,
}: {
  prayer?: MobilePublishedPrayer
  name?: string | null
  now: string
  userId: string
}) {
  const { locale, t } = useSiteI18n()
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

  return (
    <section
      aria-labelledby="home-devotional-title"
      className="grid overflow-hidden rounded-3xl bg-white sm:rounded-[28px] shadow-[0_18px_50px_rgba(24,74,140,0.10)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:grid-cols-[minmax(0,672px)_minmax(0,480px)]"
    >
      <div className="bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)] p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs font-medium text-blue-800">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-blue-800 sm:px-4 sm:py-2 shadow-sm">
            <MaskIcon className="bg-primary-500" size={12} src="/icons/icon-stars.svg" />
            {t('homeLiturgicalFocus')}
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
                  <MaskIcon className="bg-primary-500" size={14} src="/icons/icon-sound-wave.svg" />{' '}
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
                className="flex size-10 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white"
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

            <DevotionalAudioPlayer
              prayerId={prayer.id}
              src={prayer.audio?.assetUrl ?? null}
              userId={userId}
            />
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

      <PrayerQuotePanel
        prayer={
          prayer
            ? {
                id: prayer.id,
                title: prayer.version.title,
                body: prayer.version.body,
                languageCode: prayer.version.languageCode,
                churchName: prayer.churchName,
              }
            : null
        }
      />
    </section>
  )
}
