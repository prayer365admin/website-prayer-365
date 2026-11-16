'use client'

import BoxContainer from '@/components/container/boxed'
import MaskIcon from '@/components/site/mask-icon'
import { useSiteI18n } from '@/i18n/site-i18n'
import { GeneralPrayerSiteOutput } from '@/models/general-prayer'
import Link from 'next/link'
import { readingMinutes } from '@/utils/prayer-duration'
import { prayerTextForDisplay } from '@/utils/rich-text-plain'

const card = 'rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.08)]'

/** Platform daily prayer cycle index (GP-SITE-01). No church, no pastor, no cover. */
export default function GeneralPrayerCycle({
  cycle,
  todaySequence,
}: {
  cycle: GeneralPrayerSiteOutput[]
  todaySequence: number | null
}) {
  const { t } = useSiteI18n()

  return (
    <BoxContainer containerClassName="flex flex-col gap-6 py-6 md:gap-8 md:py-8">
      <header className={card}>
        <div className="p-5 sm:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-primary-500">
            <MaskIcon className="bg-primary-500" size={12} src="/icons/icon-stars.svg" />
            {t('generalPrayerEyebrow')}
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-primary-900 sm:text-3xl">
            {t('generalPrayerTitle')}
          </h1>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-neutral-600">
            {t('generalPrayerBody')}
          </p>
        </div>
      </header>

      {cycle.length === 0 ? (
        <p className={`${card} p-5 text-sm text-neutral-600`}>{t('generalPrayerEmpty')}</p>
      ) : (
        <>
          <section className={card}>
            <h2 className="border-b border-neutral-200 p-4 text-lg font-semibold text-primary-900 sm:text-xl tracking-tight">
              {t('generalPrayerCycleTitle')}
            </h2>
            <p className="px-4 pt-3 text-xs text-neutral-500">{t('generalPrayerCycleNote')}</p>
            <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {cycle.map((prayer) => {
                const isToday = todaySequence !== null && prayer.sequence === todaySequence
                const minutes = readingMinutes(prayer.body)
                return (
                  <li key={prayer.slug}>
                    <Link
                      className={`flex h-full flex-col rounded-xl border p-4 transition hover:border-primary-300 ${
                        isToday ? 'border-primary-300 bg-primary-100/50' : 'border-neutral-200'
                      }`}
                      href={`/prayers/general/${prayer.slug}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#C2D9FF] px-2.5 py-1 text-xs text-blue-800">
                          {t('generalPrayerCyclePosition', {
                            sequence: prayer.sequence,
                            total: cycle.length,
                          })}
                        </span>
                        {isToday && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-2.5 py-1 text-xs font-semibold text-white">
                            <MaskIcon
                              className="bg-white"
                              size={10}
                              src="/icons/icon-sound-wave.svg"
                            />
                            {t('generalPrayerToday')}
                          </span>
                        )}
                      </span>
                      <h3 className="mt-3 text-base font-semibold leading-normal text-primary-900">
                        {prayer.title}
                      </h3>
                      <p className="mt-1 line-clamp-3 text-sm leading-[1.6] text-neutral-600">
                        {prayerTextForDisplay(prayer.body)}
                      </p>
                      <span className="mt-auto pt-3 flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          {prayer.audioUrl
                            ? t('generalPrayerAudioAvailable')
                            : t('generalPrayerTextAvailable')}
                          {prayer.audioUrl && prayer.durationSeconds
                            ? ` · ${t('generalPrayerMinutes', {
                                minutes: Math.max(1, Math.ceil(prayer.durationSeconds / 60)),
                              })}`
                            : ` · ${t('generalPrayerMinutes', { minutes })}`}
                        </span>
                        <span className="font-semibold text-blue-800">
                          {t('generalPrayerOpen')} →
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </BoxContainer>
  )
}
