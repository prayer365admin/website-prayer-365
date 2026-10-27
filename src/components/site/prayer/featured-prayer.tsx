'use client'

import MaskIcon from '@/components/site/mask-icon'
import DevotionalAudioPlayer from '@/components/site/prayer/devotional-audio-player'
import PrayerQuotePanel from '@/components/site/prayer/prayer-quote-panel'
import { useSiteI18n } from '@/i18n/site-i18n'
import { SitePrayerArchiveItem } from '@/models/site-prayer'
import Image from 'next/image'
import { prayerTextForDisplay } from '@/utils/rich-text-plain'

export const excerpt = (value: string | null, fallback: string, max = 180) => {
  const source = prayerTextForDisplay(value || fallback)
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
  const prayerTitle = prayerTextForDisplay(prayer.title)
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.12)] lg:grid lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
      <div className="bg-[linear-gradient(135deg,rgba(194,217,255,0.35)_0%,rgba(255,255,255,0)_100%)] p-5 sm:p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-primary-500">
          <MaskIcon className="bg-primary-500" size={12} src="/icons/icon-stars.svg" />
          {eyebrow}
        </span>
        <article className="mt-4 rounded-2xl bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)] p-4 shadow-[0_1px_2px_#0000000D] sm:p-5">
          <div className="flex items-start gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[2px] text-primary-500">
                <MaskIcon className="bg-primary-500" size={14} src="/icons/icon-sound-wave.svg" />
                {t('prayerArchiveGuided')}
              </p>
              <Title className="mt-1 text-xl font-semibold leading-tight text-primary-900 sm:text-2xl">
                {prayerTitle}
              </Title>
              <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                {detail
                  ? [
                      prayer.introduction && prayerTextForDisplay(prayer.introduction),
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
          </div>
          <div className="mt-4">
            <Pastor prayer={prayer} />
          </div>
          {prayer.audio && (
            <DevotionalAudioPlayer
              prayerId={prayer.id}
              prayerSlug={prayer.slug}
              showTranscript={!detail}
              src={prayer.audio.url}
              userId={userId}
            />
          )}
        </article>
      </div>
      <PrayerQuotePanel
        showActions={detail}
        showLoveAction={false}
        prayer={{
          id: prayer.id,
          slug: prayer.slug,
          title: prayerTitle,
          body: prayer.body,
          languageCode: prayer.languageCode,
          churchName: prayer.churchName,
          churchCoverUrl: prayer.churchCoverUrl,
          featuredImageUrl: prayer.featuredImageUrl ?? null,
        }}
      />
    </section>
  )
}
