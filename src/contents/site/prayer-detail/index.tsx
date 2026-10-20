'use client'

import BoxContainer from '@/components/container/boxed'
import { QuoteIcon } from '@/components/icon/quote'
import AvatarStack from '@/components/site/avatar-stack'
import MaskIcon from '@/components/site/mask-icon'
import { FeaturedPrayer } from '@/components/site/prayer/featured-prayer'
import { readingMinutes } from '@/contents/site/prayers/data'
import { useSiteI18n } from '@/i18n/site-i18n'
import { SitePrayerDetail } from '@/models/site-prayer'
import { ArrowRightOutlined, HeartOutlined, PlusOutlined } from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'
import { ReactNode } from 'react'
import { PRAYER_DETAIL_STATIC, paragraphs } from './data'
import { PrayerDetailSidebar } from './sidebar'

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

const ActionTile = ({
  icon,
  title,
  body,
  href,
}: {
  icon: string
  title: string
  body: string
  href?: string
}) => {
  const { t } = useSiteI18n()
  const content = (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-150">
        <MaskIcon className="bg-primary-500" size={16} src={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-font_text text-sm font-semibold leading-[1.5] text-primary-900">
          {title}
        </span>
        <span className="block font-font_text text-xs leading-[1.5] text-neutral-600">{body}</span>
      </span>
      {/* Design "Primary-600" is #2555A7; this codebase's primary-600 token is #005FFF. */}
      <ArrowRightOutlined className="px-2 text-sm leading-5 text-[#2555A7]" />
    </>
  )
  const className = 'flex min-h-16 min-w-0 items-center gap-2 rounded-xl bg-neutral-100 p-2'
  return href ? (
    <Link className={`${className} transition hover:bg-primary-100`} href={href}>
      {content}
    </Link>
  ) : (
    <div
      aria-disabled="true"
      className={`${className} cursor-not-allowed`}
      title={t('homeComingSoon')}
    >
      {content}
    </div>
  )
}

/** W10 prayer reader (`prayer-details.png`). */
export default function PrayerDetail({ detail }: { detail: SitePrayerDetail }) {
  const { locale, t } = useSiteI18n()
  const { prayer, church } = detail
  // Body copy at a comfortable reading measure.
  const readingClass = 'text-base max-w-[68ch]'
  const format = prayer.audio ? t('prayerArchiveAudioAvailable') : t('prayerArchiveTextAvailable')
  return (
    <BoxContainer containerClassName="flex flex-col gap-6 py-6 md:gap-8 md:py-8 lg:gap-9">
      <FeaturedPrayer
        detail
        eyebrow={`${format} · ${t('prayerArchiveMinutes', { minutes: readingMinutes(prayer.body) })}`}
        prayer={prayer}
      />

      <div className="grid gap-6 md:gap-8 lg:grid-cols-[minmax(0,757.33fr)_minmax(0,362.67fr)] lg:gap-9">
        <div className="flex min-w-0 flex-col gap-6">
          <article className={card}>
            {prayer.introduction && (
              <Section index={1} title={t('prayerDetailSection1')}>
                <div className="rounded-xl bg-primary-100 p-4 mb-4">
                  <p
                    className={`whitespace-pre-line leading-relaxed text-neutral-600 ${readingClass}`}
                  >
                    {prayer.introduction}
                  </p>
                </div>
              </Section>
            )}

            <Section index={prayer.introduction ? 2 : 1} title={t('prayerDetailSection2')}>
              {/* Static sanctuary image for now; captions stay real. */}
              <figure className="relative mb-6 aspect-[724/288] overflow-hidden rounded-xl bg-primary-900">
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="(min-width: 1024px) 720px, 100vw"
                  src="/images/church.jpg"
                />
                <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(45,49,51,0.8)_0%,rgba(45,49,51,0.2)_50%,rgba(45,49,51,0)_100%)]" />
                <figcaption className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <span className="text-[10px] font-semibold uppercase tracking-[2px] text-white/80">
                    {t('prayerDetailSanctuary', { church: church.name })}
                  </span>
                  <span className="mt-1 block text-lg font-semibold sm:text-xl">
                    {prayer.title}
                  </span>
                </figcaption>
              </figure>
              <div className={`mb-4 space-y-4 leading-relaxed text-neutral-600 ${readingClass}`}>
                {paragraphs(prayer.body).map((paragraph, index) => (
                  <p className="whitespace-pre-line" key={index}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </Section>

            <Section index={prayer.introduction ? 3 : 2} title={t('prayerDetailSection3')}>
              <figure className="my-6 rounded-2xl bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)] p-4">
                <div className="bg-primary-100 p-4 text-center">
                  <QuoteIcon aria-hidden className="!text-primary-500" style={{ fontSize: 16 }} />
                  <blockquote className="mx-auto mt-2 max-w-xl font-font_quote text-2xl italic leading-tight text-blue-800 sm:text-[32px]">
                    “{t('prayerDetailBenediction')}”
                  </blockquote>
                  <figcaption className="mt-3 text-[10px] uppercase tracking-[2px] text-neutral-600">
                    {t('prayerDetailBenedictionCaption')}
                  </figcaption>
                </div>
              </figure>
            </Section>
          </article>

          <section className={`flex flex-col gap-4 p-4 ${card}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AvatarStack trailing={<PlusOutlined />} />
                <div>
                  <p className="text-sm font-semibold text-primary-900">
                    {t('prayerDetailParishioners', {
                      count: PRAYER_DETAIL_STATIC.parishionersToday.toLocaleString(locale),
                    })}
                  </p>
                  <p className="text-xs text-neutral-500">{t('prayerDetailParishionersBody')}</p>
                </div>
              </div>
              <button
                aria-disabled="true"
                className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 sm:w-auto text-sm font-medium text-white"
                title={t('homeComingSoon')}
                type="button"
              >
                <HeartOutlined /> {t('prayerDetailPrayed')}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ActionTile
                body={t('prayerDetailCandleBody', { church: church.name })}
                icon="/icons/icon-candle-holder.svg"
                title={t('prayerDetailCandle')}
              />
              <ActionTile
                body={t('prayerDetailNoteBody')}
                href="/#prayer-petition"
                icon="/icons/icon-file-pen.svg"
                title={t('prayerDetailNote')}
              />
            </div>
          </section>
        </div>

        <PrayerDetailSidebar detail={detail} />
      </div>
    </BoxContainer>
  )
}
