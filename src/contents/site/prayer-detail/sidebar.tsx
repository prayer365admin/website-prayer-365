'use client'

import MaskIcon from '@/components/site/mask-icon'
import { readingMinutes } from '@/contents/site/prayers/data'
import { useSiteI18n } from '@/i18n/site-i18n'
import { SitePrayerDetail } from '@/models/site-prayer'
import { ArrowRightOutlined, FilePdfOutlined, PhoneOutlined } from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'
import { PRAYER_DETAIL_STATIC } from './data'

const card = 'rounded-2xl bg-white shadow-[0_8px_30px_rgba(24,74,140,0.08)]'
const softButton =
  'flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary-150 text-sm font-medium text-blue-800 transition hover:bg-primary-300/40'

/** W10 right rail: pastor, liturgical context, sibling prayers, crisis support. */
export function PrayerDetailSidebar({ detail }: { detail: SitePrayerDetail }) {
  const { t } = useSiteI18n()
  const { prayer, church, related } = detail
  const contextRows = [
    { label: t('prayerDetailSeason'), value: PRAYER_DETAIL_STATIC.season, dot: true },
    { label: t('prayerDetailTranslation'), value: PRAYER_DETAIL_STATIC.translation, dot: false },
  ]

  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <section className={card}>
        <h2 className="border-b border-neutral-200 p-4 text-xl font-semibold text-primary-900">
          {t('prayerDetailLeadership')}
        </h2>
        <div className="p-4">
          <div className="flex items-start gap-3">
            {prayer.pastorImageUrl ? (
              <Image
                alt=""
                className="size-12 shrink-0 rounded-full object-cover"
                height={48}
                src={prayer.pastorImageUrl}
                width={48}
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-500 font-semibold text-white">
                {prayer.pastorName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold text-primary-900">
                <span className="truncate">{prayer.pastorName}</span>
                <MaskIcon className="bg-primary-500" size={14} src="/icons/icon-verified.svg" />
              </p>
              <p className="text-xs text-primary-500">
                {[prayer.pastorRole, church.name].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>
          {prayer.pastorBio && (
            <p className="mt-4 line-clamp-5 text-sm leading-6 text-neutral-600">
              {prayer.pastorBio}
            </p>
          )}
          <Link className={`mt-4 ${softButton}`} href={`/churches/${church.slug}`}>
            {t('prayerDetailViewChurch', {
              church: church.city ? `${church.name} (${church.city})` : church.name,
            })}
            <ArrowRightOutlined />
          </Link>
        </div>
      </section>

      <section className={`p-4 ${card}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-primary-900">{t('prayerDetailContext')}</h2>
          <span className="rounded-full bg-[#B9D8F8] px-2.5 py-0.5 text-xs text-blue-800">
            {t('homeHabitsStreak')}
          </span>
        </div>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          {contextRows.map((row) => (
            <div
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
              key={row.label}
            >
              <dt className="text-primary-900">{row.label}</dt>
              <dd className="flex items-center gap-1.5 text-right text-xs text-neutral-500">
                {row.dot && <span className="size-2 rounded-full bg-success-500" />}
                {row.value}
              </dd>
            </div>
          ))}
          <div className="rounded-lg border border-neutral-200 px-3 py-2">
            <dt className="text-primary-900">{t('prayerDetailMusic')}</dt>
            <dd className="mt-1 text-xs font-semibold text-primary-900">
              {PRAYER_DETAIL_STATIC.musicTitle}
              <span className="block font-normal text-neutral-400">
                {PRAYER_DETAIL_STATIC.musicNote}
              </span>
            </dd>
          </div>
        </dl>
        {/* The browser's print dialog saves the reader as a PDF booklet. */}
        <button className={`mt-4 ${softButton}`} onClick={() => window.print()} type="button">
          {t('prayerDetailPrint')} <FilePdfOutlined />
        </button>
      </section>

      {related.length > 0 && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-4">
            <h2 className="text-xl font-semibold text-primary-900">{t('prayerDetailArc')}</h2>
            <Link
              className="inline-flex items-center gap-2 text-xs font-medium text-primary-500"
              href={`/churches/${church.slug}/prayers`}
            >
              {t('prayerDetailSeeArc')} <ArrowRightOutlined />
            </Link>
          </div>
          <ul className="flex flex-col gap-3 p-4">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  className="block rounded-xl bg-neutral-50 p-3 transition hover:bg-primary-100"
                  href={`/prayers/${item.id}`}
                >
                  <span className="flex justify-between gap-3 text-xs text-neutral-500">
                    <span>
                      {item.languageCode.toUpperCase()} •{' '}
                      {item.audio
                        ? t('prayerArchiveAudioAvailable')
                        : t('prayerArchiveTextAvailable')}
                    </span>
                    <span>{t('prayerArchiveMinutes', { minutes: readingMinutes(item.body) })}</span>
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-primary-900">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-neutral-400 mb-2">
                    {item.introduction || item.body}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-[image:linear-gradient(var(--color-overlay-navy),var(--color-overlay-navy)),url('/images/sanctuary-banner.webp')] bg-cover bg-center p-4 text-white shadow-[0_12px_36px_rgba(11,58,140,0.25)]">
        <div className="flex items-center gap-3 border-b border-white/15 pb-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <MaskIcon className="bg-white" size={18} src="/icons/icon-user-headset.svg" />
          </span>
          <h2 className="text-xl font-semibold leading-snug">{t('prayerDetailCrisisTitle')}</h2>
        </div>
        <p className="mt-4 text-xs leading-5 text-white/80">{t('prayerDetailCrisisBody')}</p>
        <a
          className="mt-4 flex items-center gap-4 rounded-xl bg-white/10 p-4 text-white transition hover:bg-white/15 hover:text-white"
          href={`tel:${PRAYER_DETAIL_STATIC.crisisPhone.replace(/\s/g, '')}`}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-primary-500">
            <PhoneOutlined className="rotate-90" />
          </span>
          <span>
            <span className="block text-[10px] font-semibold uppercase tracking-[2px] text-white/70">
              {t('prayerDetailCrisisLabel')}
            </span>
            <span className="block text-xl font-semibold">{PRAYER_DETAIL_STATIC.crisisPhone}</span>
          </span>
        </a>
      </section>
    </aside>
  )
}
