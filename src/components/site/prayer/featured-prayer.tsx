'use client'

import MaskIcon from '@/components/site/mask-icon'
import DevotionalAudioPlayer from '@/components/site/prayer/devotional-audio-player'
import PrayerQuotePanel from '@/components/site/prayer/prayer-quote-panel'
import { useSiteI18n } from '@/i18n/site-i18n'
import { SitePrayerArchiveItem } from '@/models/site-prayer'
import Image from 'next/image'
import Link from 'next/link'

export const excerpt = (value: string | null, fallback: string, max = 180) => {
  const source = value?.trim() || fallback.trim()
  return source.length > max ? `${source.slice(0, max).trimEnd()}…` : source
}

export const Pastor = ({ prayer }: { prayer: SitePrayerArchiveItem }) => (
  <div className="flex min-w-0 items-center gap-3">
    {prayer.pastorImageUrl ? (
      <Image
        alt=""
        className="size-9 shrink-0 rounded-full object-cover"
        height={36}
        src={prayer.pastorImageUrl}
        width={36}
      />
    ) : (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white">
        {prayer.pastorName.charAt(0).toUpperCase()}
      </span>
    )}
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-900">
        <span className="truncate">{prayer.pastorName}</span>
        <MaskIcon className="bg-primary-500" size={14} src="/icons/icon-verified.svg" />
      </p>
      <p className="truncate text-xs text-neutral-500">
        {prayer.pastorRole ? `${prayer.pastorRole} · ` : ''}
        {prayer.churchName}
      </p>
    </div>
  </div>
)

/**
 * Guided-contemplation block + lake quote column. Archive: featured prayer (W09).
 * Detail: the reader hero (W10) — h1 title, full introduction, no transcript link.
 */
export const FeaturedPrayer = ({
  prayer,
  eyebrow,
  detail = false,
  userId,
}: {
  prayer: SitePrayerArchiveItem
  eyebrow: string
  detail?: boolean
  userId: string
}) => {
  const { t } = useSiteI18n()
  const Title = detail ? 'h1' : 'h2'
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.12)] lg:grid lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
      <div className="bg-[linear-gradient(135deg,rgba(194,217,255,0.35)_0%,rgba(255,255,255,0)_100%)] p-5 sm:p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-primary-500">
          <MaskIcon className="bg-primary-500" size={12} src="/icons/icon-stars.svg" />
          {eyebrow}
        </span>
        <article className="mt-4 rounded-2xl bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)] p-4 shadow-[0_1px_2px_#0000000D] sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[2px] text-primary-500">
                <MaskIcon className="bg-primary-500" size={14} src="/icons/icon-sound-wave.svg" />
                {t('prayerArchiveGuided')}
              </p>
              <Title className="mt-1 text-xl font-semibold leading-tight text-primary-900 sm:text-2xl">
                {prayer.title}
              </Title>
              <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                {detail
                  ? [
                      prayer.introduction,
                      t('prayerDetailLedBy', {
                        pastor: prayer.pastorName,
                        church: prayer.churchName,
                      }),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : excerpt(prayer.introduction, prayer.body)}
              </p>
            </div>
            {!detail && (
              <Link
                aria-label={t('prayerArchiveView')}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white"
                href={`/prayers/${prayer.id}`}
              >
                <MaskIcon className="bg-blue-800" size={16} src="/icons/icon-bookmark.svg" />
              </Link>
            )}
          </div>
          <div className="mt-4">
            <Pastor prayer={prayer} />
          </div>
          {prayer.audio && (
            <DevotionalAudioPlayer
              prayerId={prayer.id}
              showTranscript={!detail}
              src={prayer.audio.url}
              userId={userId}
            />
          )}
        </article>
      </div>
      <PrayerQuotePanel
        showLoveAction={!detail}
        prayer={{
          id: prayer.id,
          title: prayer.title,
          body: prayer.body,
          languageCode: prayer.languageCode,
          churchName: prayer.churchName,
        }}
      />
    </section>
  )
}
