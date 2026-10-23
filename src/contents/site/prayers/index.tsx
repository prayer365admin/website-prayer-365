'use client'

import BoxContainer from '@/components/container/boxed'
import { FeaturedPrayer, Pastor, excerpt } from '@/components/site/prayer/featured-prayer'
import MaskIcon from '@/components/site/mask-icon'
import { useSiteI18n } from '@/i18n/site-i18n'
import {
  SitePrayerArchive,
  SitePrayerArchiveItem,
  SitePrayerArchiveQuery,
} from '@/models/site-prayer'
import { siteFilterTheme } from '@/config/antdTheme'
import { DownOutlined, LoadingOutlined, SearchOutlined } from '@ant-design/icons'
import { ConfigProvider, Select, SelectProps } from 'antd'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { PRAYER_COMMUNITY, PRAYER_TOPIC_CHIPS, lectionaryYear, readingMinutes } from './data'

const FilterSelect = ({
  id,
  label,
  ...props
}: SelectProps<string> & { id: string; label: string }) => (
  <div>
    <label className="block text-sm font-medium text-primary-900" htmlFor={id}>
      {label}
    </label>
    <Select<string>
      allowClear
      className="mt-1.5 w-full"
      classNames={{ popup: { root: 'rounded-lg p-1 shadow-[0_8px_30px_rgba(24,74,140,0.14)]' } }}
      id={id}
      suffixIcon={<DownOutlined className="text-xs text-primary-900" />}
      {...props}
    />
  </div>
)

const metaIcon = 'bg-[#B0B6BF]'

const PrayerCard = ({ prayer }: { prayer: SitePrayerArchiveItem }) => {
  const { t } = useSiteI18n()
  const format = prayer.audio ? t('prayerArchiveAudioAvailable') : t('prayerArchiveTextAvailable')
  return (
    <article className="flex h-full flex-col rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(24,74,140,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-[#C2D9FF] px-2.5 py-1 text-xs text-blue-800">
          {format} · {t('prayerArchiveMinutes', { minutes: readingMinutes(prayer.body) })}
        </span>
        <MaskIcon className="bg-blue-800" size={16} src="/icons/icon-bookmark.svg" />
      </div>
      <h3 className="mt-4 text-base font-semibold leading-normal text-primary-900">
        {prayer.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-[1.6] text-neutral-600">
        {excerpt(prayer.introduction, prayer.body)}
      </p>
      <blockquote className="mt-4 rounded-lg bg-primary-100 p-4 font-font_quote text-base italic leading-[1.3] text-blue-800">
        <p className="line-clamp-3">“{excerpt(prayer.body, prayer.title, 145)}”</p>
      </blockquote>
      <div className="mt-auto pt-5">
        <Pastor prayer={prayer} />
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <MaskIcon className={metaIcon} size={14} src="/icons/icon-language-2.svg" />
            {prayer.languageCode.toUpperCase()}
          </span>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1.5">
            <MaskIcon className={metaIcon} size={12} src="/icons/icon-music.svg" />
            {t('prayerArchiveMinutes', { minutes: readingMinutes(prayer.body) })}
          </span>
          {prayer.audio && (
            <>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1.5">
                <MaskIcon className={metaIcon} size={12} src="/icons/icon-headphones.svg" />
                {t('prayerArchiveAudio')}
              </span>
            </>
          )}
        </div>
        <Link
          className="mt-4 flex h-10 items-center justify-center gap-3 rounded-lg bg-primary-150 text-sm font-medium text-blue-800 transition hover:bg-primary-300/40"
          href={`/prayers/${prayer.id}`}
        >
          {t('prayerArchiveView')}
          <MaskIcon className="bg-blue-800" size={18} src="/icons/Icon-arrow-right.svg" />
        </Link>
      </div>
    </article>
  )
}

const queryHref = (basePath: string, query: SitePrayerArchiveQuery, page: number) => {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.churchId) params.set('churchId', query.churchId)
  if (query.language) params.set('language', query.language)
  if (query.format !== 'all') params.set('format', query.format)
  if (page > 1) params.set('page', String(page))
  const suffix = params.toString()
  return `${basePath}${suffix ? `?${suffix}` : ''}`
}

export default function PrayerArchive({
  archive,
  basePath = '/prayers',
  query,
  fixedChurchName,
}: {
  archive: SitePrayerArchive
  basePath?: string
  query: SitePrayerArchiveQuery
  fixedChurchName?: string
}) {
  const { locale, t } = useSiteI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [prevSearch, setPrevSearch] = useState(query.search ?? '')
  const [searchValue, setSearchValue] = useState(query.search ?? '')

  if (prevSearch !== (query.search ?? '')) {
    setPrevSearch(query.search ?? '')
    setSearchValue(query.search ?? '')
  }
  // Filters are URL-driven: a change navigates to page 1 of the new result set.
  const applyFilter = (patch: Partial<SitePrayerArchiveQuery>) =>
    startTransition(() => {
      router.push(queryHref(basePath, { ...query, ...patch }, 1))
    })

  useEffect(() => {
    const trimmed = searchValue.trim()
    if (trimmed === (query.search ?? '').trim()) return
    const timer = setTimeout(() => {
      applyFilter({ search: trimmed })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchValue, query.search])
  const languageName = (code: string) =>
    new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code.toUpperCase()
  const from = archive.total === 0 ? 0 : (archive.page - 1) * archive.limit + 1
  const to = Math.min(archive.page * archive.limit, archive.total)
  const pageNumbers = Array.from({ length: archive.totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === archive.totalPages || Math.abs(page - archive.page) <= 1,
  )

  // One section rhythm per breakpoint: 24px mobile, 32px tablet, 36px desktop.
  return (
    <BoxContainer containerClassName="flex flex-col gap-6 py-6 md:gap-8 md:py-8 lg:gap-9">
      <header
        className="relative isolate overflow-hidden rounded-2xl p-5 shadow-[0_1px_2px_0_#0000000D,-1px_-1px_2px_0_#FFFFFF] sm:p-6 md:min-h-[348.5px]"
        style={{
          // Figma lists the white base fill first; in CSS the first layer paints on top, so the tint goes first.
          background:
            'linear-gradient(135deg, rgba(194, 217, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%), #FFFFFF',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-40 -z-10 size-96 rounded-full bg-[linear-gradient(135deg,rgba(131,192,255,0.2)_0%,rgba(0,92,173,0.05)_100%)] blur-[64px]"
        />

        <div className="relative overflow-hidden rounded-xl bg-primary-100 p-4 sm:p-6">
          <div className="relative z-20">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-3 py-1 font-font_heading text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-blue-800">
                <MaskIcon className="bg-blue-800" size={13} src="/icons/icon-book-bible.svg" />
                {t('prayerArchiveEyebrow')}
              </span>
              <span className="text-xs text-neutral-500">
                {fixedChurchName
                  ? t('prayerArchiveChurchContext')
                  : t('prayerArchiveYear', { year: lectionaryYear(new Date()) })}
              </span>
            </div>
            <h1 className="mt-4 max-w-4xl font-font_heading text-2xl font-bold leading-none tracking-[-1px] text-[#191C1E] sm:text-[32px]">
              {fixedChurchName || t('prayerArchiveTitle')}
            </h1>
            <p className="mt-2 max-w-3xl font-font_text text-base font-normal leading-[1.5] tracking-normal text-neutral-600">
              {t('prayerArchiveBody')}
            </p>
          </div>
        </div>

        <form
          className="relative z-20 mt-4"
          method="get"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = searchValue.trim()
            applyFilter({ search: trimmed })
          }}
        >
          {query.churchId && <input name="churchId" type="hidden" value={query.churchId} />}
          {query.language && <input name="language" type="hidden" value={query.language} />}
          {query.format !== 'all' && <input name="format" type="hidden" value={query.format} />}
          <label className="relative block">
            <span className="sr-only">{t('prayerArchiveSearch')}</span>
            <SearchOutlined className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              className="h-12 w-full rounded-lg border border-neutral-400 bg-white pl-10 pr-10 text-sm text-primary-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-300/30"
              name="search"
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={t('prayerArchiveSearch')}
              type="search"
              value={searchValue}
            />
            {isPending && (
              <LoadingOutlined className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary-500" />
            )}
          </label>
          <div className="mt-4 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_92%,transparent)]">
            <button
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-primary-500 px-4 text-sm font-medium text-white"
              type="submit"
            >
              {t('prayerArchiveAll')}
              <span className="rounded-full bg-white/20 px-1.5 text-xs">
                {archive.total + (archive.featured ? 1 : 0)}
              </span>
            </button>
            {PRAYER_TOPIC_CHIPS.map((chip) => (
              <span
                className="inline-flex h-8 shrink-0 items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-500"
                key={chip.label}
                title={t('homeComingSoon')}
              >
                {t(chip.label)}
                <span className="text-xs text-neutral-400">{chip.count}</span>
              </span>
            ))}
          </div>
        </form>
      </header>

      <ConfigProvider theme={siteFilterTheme}>
        <div
          className={`grid gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_2px_#0000000D] sm:grid-cols-2 ${fixedChurchName ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}
        >
          {/* "All …" is the empty state (placeholder), so the clear button only shows for a real choice. */}
          {!fixedChurchName && (
            <FilterSelect
              id="prayer-filter-church"
              label={t('prayerArchiveChurch')}
              onChange={(churchId) => applyFilter({ churchId: churchId ?? '' })}
              options={archive.churches}
              placeholder={t('prayerArchiveAllChurches')}
              value={query.churchId || undefined}
            />
          )}
          <FilterSelect
            id="prayer-filter-language"
            label={t('prayerArchiveLanguage')}
            onChange={(language) => applyFilter({ language: language ?? '' })}
            options={archive.languages.map((language) => ({
              value: language,
              label: languageName(language),
            }))}
            placeholder={t('prayerArchiveAllLanguages')}
            value={query.language || undefined}
          />
          {/* No duration metadata yet: nothing to choose, so nothing to clear. */}
          <FilterSelect
            id="prayer-filter-duration"
            label={t('prayerArchiveDuration')}
            options={[]}
            placeholder={t('prayerArchiveAnyDuration')}
            title={t('prayerArchiveDurationUnavailable')}
          />
          <FilterSelect
            id="prayer-filter-format"
            label={t('prayerArchiveFormat')}
            onChange={(format) =>
              applyFilter({ format: (format ?? 'all') as SitePrayerArchiveQuery['format'] })
            }
            options={[
              { value: 'audio', label: t('prayerArchiveAudio') },
              { value: 'text', label: t('prayerArchiveText') },
            ]}
            placeholder={t('prayerArchiveAllFormats')}
            value={query.format === 'all' ? undefined : query.format}
          />
        </div>
      </ConfigProvider>

      {archive.churches.length === 0 ? (
        <section className="rounded-2xl bg-[#F5F7FF] p-8 text-center">
          <h2 className="text-xl font-semibold text-primary-900">
            {t('prayerArchiveNoChurchTitle')}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">{t('prayerArchiveNoChurchBody')}</p>
          <Link
            className="mt-5 inline-flex rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white"
            href="/customer"
          >
            {t('prayerArchiveOpenProfile')}
          </Link>
        </section>
      ) : (
        <>
          {archive.featured && (
            <FeaturedPrayer eyebrow={t('prayerArchiveFeatured')} prayer={archive.featured} />
          )}

          <section
            aria-busy={isPending}
            aria-labelledby="prayer-collection-title"
            className={`transition-opacity duration-200 ${isPending ? 'pointer-events-none opacity-50' : ''}`}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  className="text-2xl font-semibold tracking-[-0.02em] text-primary-900 sm:text-[28px]"
                  id="prayer-collection-title"
                >
                  {t('prayerArchiveCollection')}
                </h2>
                <p className="mt-1 text-base text-neutral-600">
                  {t('prayerArchiveCollectionBody')}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-primary-500">
                <span className="size-2 rounded-full bg-primary-500" />
                {t('prayerArchiveCollectionNote')}
              </span>
            </div>

            {archive.result.length ? (
              <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {archive.result.map((prayer) => (
                  <PrayerCard key={prayer.id} prayer={prayer} />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-[0_8px_30px_rgba(24,74,140,0.08)]">
                <h3 className="text-lg font-semibold text-primary-900">
                  {t('prayerArchiveEmptyTitle')}
                </h3>
                <p className="mt-2 text-sm text-neutral-600">{t('prayerArchiveEmptyBody')}</p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(24,74,140,0.08)] lg:flex-row lg:items-center">
            <div className="flex items-center gap-4 rounded-xl bg-neutral-50 p-3 pr-4">
              <span className="relative size-12 shrink-0">
                <svg aria-hidden="true" className="size-full -rotate-90" viewBox="0 0 48 48">
                  <circle
                    className="stroke-neutral-200"
                    cx="24"
                    cy="24"
                    fill="none"
                    r="21"
                    strokeWidth="4"
                  />
                  <circle
                    className="stroke-primary-500"
                    cx="24"
                    cy="24"
                    fill="none"
                    r="21"
                    strokeDasharray={2 * Math.PI * 21}
                    strokeDashoffset={
                      2 *
                      Math.PI *
                      21 *
                      (1 - PRAYER_COMMUNITY.streakDays / PRAYER_COMMUNITY.streakGoal)
                    }
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-primary-500">
                  {PRAYER_COMMUNITY.streakDays}
                </span>
              </span>
              <div>
                <p className="text-sm font-semibold text-primary-900">
                  {t('prayerArchiveStreakTitle')}
                </p>
                <p className="text-xs text-neutral-500">{t('prayerArchiveStreakBody')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-neutral-50 p-3 pr-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-150">
                <MaskIcon className="bg-primary-500" size={20} src="/icons/icon-users.svg" />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary-900">
                  {t('prayerArchiveBelieversTitle', {
                    count: PRAYER_COMMUNITY.believersToday.toLocaleString(locale),
                  })}
                </p>
                <p className="text-xs text-neutral-500">
                  {t('prayerArchiveBelieversBody', { parishes: PRAYER_COMMUNITY.parishes })}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary-500 px-4 text-sm font-medium text-blue-800 transition hover:bg-primary-100 lg:ml-auto"
              href="/#prayer-petition"
            >
              <MaskIcon className="bg-primary-500" size={16} src="/icons/icon-prayer-love.svg" />
              {t('prayerArchiveRequest')}
            </Link>
          </section>

          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <p className="text-xs text-neutral-600">
              {t('prayerArchiveShowing', { from, to, total: archive.total })}
            </p>
            <div className="flex items-center gap-2">
              {archive.page > 1 && (
                <Link
                  aria-label={t('prayerArchivePrevious')}
                  className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white"
                  href={queryHref(basePath, query, archive.page - 1)}
                >
                  ‹
                </Link>
              )}
              {pageNumbers.map((page, index) => (
                <span className="contents" key={page}>
                  {index > 0 && pageNumbers[index - 1] !== page - 1 && (
                    <span className="text-neutral-500">…</span>
                  )}
                  <Link
                    aria-current={page === archive.page ? 'page' : undefined}
                    className={`flex size-8 items-center justify-center rounded-lg border text-xs ${page === archive.page ? 'border-primary-500 bg-primary-500 text-white' : 'border-neutral-200 bg-white text-primary-900'}`}
                    href={queryHref(basePath, query, page)}
                  >
                    {page}
                  </Link>
                </span>
              ))}
              {archive.page < archive.totalPages && (
                <Link
                  aria-label={t('prayerArchiveNext')}
                  className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white"
                  href={queryHref(basePath, query, archive.page + 1)}
                >
                  ›
                </Link>
              )}
            </div>
          </nav>

          {/* Lectionary banner: static copy until a liturgical calendar source and PDF exist. */}
          <section className="rounded-2xl bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0.45)_100%)] p-4 shadow-[0_4px_24px_-4px_#005CAD0F,0_1px_2px_0_#0000000D,-1px_-1px_2px_0_#FFFFFF]">
            <div className="flex flex-col justify-between gap-5 rounded-xl bg-primary-100 p-4 lg:flex-row lg:items-center">
              <div className="flex gap-4 sm:gap-6">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-500">
                  <Image alt="" aria-hidden height={20} src="/icons/icon-calender.svg" width={14} />
                </span>
                <div>
                  <h2 className="font-font_text text-lg font-semibold leading-[1.5] text-primary-900 sm:text-xl">
                    {t('prayerArchiveBannerTitle')}
                  </h2>
                  <p className="mt-2 font-font_text text-base font-normal leading-6 text-neutral-600">
                    {t('prayerArchiveBannerBody')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-3 lg:w-[266px]">
                <p className="text-center text-sm text-neutral-500">
                  {t('prayerArchiveBannerCaption')}
                </p>
                <button
                  aria-disabled="true"
                  className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-primary-600 bg-primary-500 pb-[9px] pl-6 pr-5 pt-[7px] text-base font-medium text-white"
                  title={t('homeComingSoon')}
                  type="button"
                >
                  {t('prayerArchiveBannerAction')}
                  <MaskIcon className="bg-white" size={18} src="/icons/icon-download.svg" />
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </BoxContainer>
  )
}
