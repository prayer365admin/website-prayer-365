'use client'

import BoxContainer from '@/components/container/boxed'
import RichTextContent from '@/components/common/rich-text-content'
import GeneralPrayerAudio from '@/components/site/prayer/general-prayer-audio'
import { useSiteI18n } from '@/i18n/site-i18n'
import { GeneralPrayerSiteOutput } from '@/models/general-prayer'
import Link from 'next/link'
import { readingMinutes } from '@/utils/prayer-duration'

const card = 'rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.08)]'

/** Real generated-audio minutes when present; the reading estimate otherwise. */
const prayerDurationMinutesFor = (prayer: GeneralPrayerSiteOutput) =>
  prayer.durationSeconds && prayer.durationSeconds > 0
    ? Math.max(1, Math.ceil(prayer.durationSeconds / 60))
    : readingMinutes(prayer.body)

/** Platform daily prayer reader (GP-SITE-02). Estonian content, translated chrome, no church block. */
export default function GeneralPrayerDetail({
  prayer,
  sentOn,
}: {
  prayer: GeneralPrayerSiteOutput
  /** The day's send date (`dd.MM.yyyy`), never a weekday label. */
  sentOn: string
}) {
  const { t } = useSiteI18n()
  const readingClass = 'text-base max-w-[68ch]'
  // Audio-ready rows show real duration; text-only rows keep the reading estimate.
  const minutes = prayerDurationMinutesFor(prayer)

  return (
    <BoxContainer containerClassName="flex flex-col gap-6 py-6 md:gap-8 md:py-8">
      <article className={card}>
        <div className="p-5 sm:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[2px] text-primary-500">
            {t('generalPrayerEyebrow')} · {t('generalPrayerSentOn', { date: sentOn })}
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-primary-900 sm:text-3xl">
            {prayer.title}
          </h1>
          {prayer.verse && (
            <div className="mt-4 rounded-xl bg-primary-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[2px] text-primary-500">
                {t('generalPrayerVerse')}
                {prayer.verseReference ? ` · ${prayer.verseReference}` : ''}
              </p>
              <div className={`mt-2 italic text-neutral-700 ${readingClass}`}>{prayer.verse}</div>
            </div>
          )}
          {prayer.liturgicalNote && (
            <p className="mt-4 rounded-xl bg-neutral-100 px-4 py-3 text-xs text-neutral-600">
              {prayer.liturgicalNote}
            </p>
          )}
          <p className="mt-4 text-xs font-medium text-neutral-500">
            {prayer.audioUrl ? t('generalPrayerAudioAvailable') : t('generalPrayerTextAvailable')} ·{' '}
            {t('generalPrayerMinutes', { minutes })}
          </p>
          <GeneralPrayerAudio seed={prayer.slug} src={prayer.audioUrl} />
          {prayer.introduction && (
            <div className="mt-4 border-l-2 border-primary-300 pl-4 text-primary-700">
              <RichTextContent className="leading-relaxed" html={prayer.introduction} />
            </div>
          )}
          <div className={`mt-6 leading-relaxed text-neutral-600 ${readingClass}`}>
            <RichTextContent html={prayer.body} />
          </div>
          {prayer.references && (
            <div className="mt-6 border-t border-neutral-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[2px] text-primary-500">
                {t('generalPrayerReferences')}
              </p>
              <p className="mt-2 text-sm text-neutral-600">{prayer.references}</p>
            </div>
          )}
          <p className="mt-6 text-xs text-neutral-500">{t('generalPrayerContentLanguage')}</p>
        </div>
      </article>

      <Link
        className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 transition hover:border-primary-300"
        href="/prayers/general"
      >
        {t('generalPrayerBackToCycle')}
      </Link>
    </BoxContainer>
  )
}
