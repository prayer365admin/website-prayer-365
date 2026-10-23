'use client'

import BoxContainer from '@/components/container/boxed'
import RichTextContent from '@/components/common/rich-text-content'
import { HandHeartIcon } from '@/components/icon/hand-heart'
import { FeaturedPrayer } from '@/components/site/prayer/featured-prayer'
import { prayerDurationMinutes } from '@/contents/site/prayers/data'
import { useSiteI18n } from '@/i18n/site-i18n'
import { SitePrayerDetail } from '@/models/site-prayer'
import { ArrowRightOutlined } from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'
import { ReactNode } from 'react'
import { PrayerDetailSidebar } from './sidebar'
import { stripAudioTags } from '@/utils/strip-audio-tags'

const card = 'rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.08)]'

const Section = ({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: ReactNode
}) => (
  <section className="border-t border-neutral-200 first:border-t-0">
    <h2 className="flex items-center gap-4 border-b border-neutral-200 p-4 text-xl font-semibold text-primary-900 sm:text-2xl tracking-tight">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-150 text-base font-medium text-primary-500">
        {index}
      </span>
      {title}
    </h2>
    <div className="p-4">{children}</div>
  </section>
)

/** W10 prayer reader (`prayer-details.png`). */
export default function PrayerDetail({
  detail,
  userId,
}: {
  detail: SitePrayerDetail
  userId: string
}) {
  const { t } = useSiteI18n()
  const { prayer, church } = detail
  const prayerTitle = stripAudioTags(prayer.title)
  const prayerIntroduction = prayer.introduction && stripAudioTags(prayer.introduction)
  const prayerBody = stripAudioTags(prayer.body)
  // Body copy at a comfortable reading measure.
  const readingClass = 'text-base max-w-[68ch]'
  const format = prayer.audio ? t('prayerArchiveAudioAvailable') : t('prayerArchiveTextAvailable')
  const minutes = prayerDurationMinutes(prayer.body, prayer.audio?.durationSeconds)
  return (
    <BoxContainer containerClassName="flex flex-col gap-6 py-6 md:gap-8 md:py-8 lg:gap-9">
      <FeaturedPrayer
        detail
        eyebrow={`${format} · ${t('prayerArchiveMinutes', { minutes })}`}
        prayer={prayer}
        userId={userId}
      />

      <div className="grid gap-6 md:gap-8 lg:grid-cols-[minmax(0,757.33fr)_minmax(0,362.67fr)] lg:gap-9">
        <div className="flex min-w-0 flex-col gap-6">
          <article className={card}>
            {prayerIntroduction && (
              <Section index={1} title={t('prayerDetailSection1')}>
                <div className="rounded-xl bg-primary-100 p-4 mb-4">
                  <RichTextContent
                    className={`leading-relaxed text-neutral-600 ${readingClass}`}
                    html={prayerIntroduction}
                  />
                </div>
              </Section>
            )}

            <Section index={prayerIntroduction ? 2 : 1} title={t('prayerDetailSection2')}>
              <figure className="relative mb-6 aspect-[724/288] overflow-hidden rounded-xl bg-primary-900">
                <Image
                  alt={prayerTitle}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 720px, 100vw"
                  src={church.imageUrl ?? '/images/church.jpg'}
                />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(45,49,51,0.8)_0%,rgba(45,49,51,0.2)_50%,rgba(45,49,51,0)_100%)]" />
                <figcaption className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <span className="text-[10px] font-semibold uppercase tracking-[2px] text-white/80">
                    {t('prayerDetailSanctuary', { church: church.name })}
                  </span>
                  <span className="mt-1 block text-lg font-semibold sm:text-xl">{prayerTitle}</span>
                </figcaption>
              </figure>
              <RichTextContent
                className={`mb-4 leading-relaxed text-neutral-600 ${readingClass}`}
                html={prayerBody}
              />
            </Section>
          </article>

          <section className="flex flex-col gap-4 rounded-2xl bg-[linear-gradient(135deg,#163B66,#0E294A)] p-5 text-white shadow-[0_8px_30px_rgba(24,74,140,0.08)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <HandHeartIcon className="text-2xl" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {t('prayerArchiveStewardshipLabel')}
                </h2>
                <p className="mt-1 max-w-[58ch] text-sm leading-6 text-white/80">
                  {t('prayerDetailDonationBody', { church: church.name })}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-primary-900 transition hover:bg-primary-100"
              href={`/donate/${church.id}`}
            >
              {t('donate')}
              <ArrowRightOutlined />
            </Link>
          </section>
        </div>

        <PrayerDetailSidebar detail={detail} />
      </div>
    </BoxContainer>
  )
}
