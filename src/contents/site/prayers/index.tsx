'use client'

import BoxContainer from '@/components/container/boxed'
import { FeaturedPrayer, Pastor, excerpt } from '@/components/site/prayer/featured-prayer'
import MaskIcon from '@/components/site/mask-icon'
import { siteFilterTheme } from '@/config/antdTheme'
import { useSitePrayerArchive } from '@/hooks/data/site/prayer-archive'
import { useSiteI18n } from '@/i18n/site-i18n'
import {
  SitePrayerArchive,
  SitePrayerArchiveItem,
  SitePrayerArchiveQuery,
} from '@/models/site-prayer'
import { DownOutlined, SearchOutlined } from '@ant-design/icons'
import { ConfigProvider, Select, SelectProps } from 'antd'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readingMinutes } from './data'

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
          href={`/prayers/${prayer.slug}`}
        >
          {t('prayerArchiveView')}
          <MaskIcon className="bg-blue-800" size={18} src="/icons/Icon-arrow-right.svg" />
        </Link>
      </div>
    </article>
  )
}

export default function PrayerArchive({
  archive,
  initialQuery,
  fixedChurchId,
  fixedChurchName,
  userId,
}: {
  archive: SitePrayerArchive
  initialQuery: SitePrayerArchiveQuery
  fixedChurchId?: string
  fixedChurchName?: string
  userId: string
}) {
  const { locale, t } = useSiteI18n()
  const [search, setSearch] = useState(initialQuery.search)
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search)
  const [language, setLanguage] = useState(initialQuery.language)
  const [duration, setDuration] = useState(initialQuery.duration)
  const [format, setFormat] = useState(initialQuery.format)
  const [page, setPage] = useState(initialQuery.page)

  // Only a changed search resets the page; firing on mount would undo paging.
  useEffect(() => {
    const next = search.trim()
    if (next === debouncedSearch) return
    const timeout = setTimeout(() => {
      setDebouncedSearch(next)
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, debouncedSearch])

  const query: SitePrayerArchiveQuery = {
    ...initialQuery,
    page,
    search: debouncedSearch,
    language,
    duration,
    format,
  }
  const { data, loading } = useSitePrayerArchive({
    query,
    initialQuery,
    initialData: archive,
    fixedChurchId,
  })
  const currentPage = data.page
  const from = data.total === 0 ? 0 : (currentPage - 1) * data.limit + 1
  const to = Math.min(currentPage * data.limit, data.total)
  const pageNumbers = Array.from({ length: data.totalPages }, (_, index) => index + 1).filter(
    (pageNumber) =>
      pageNumber === 1 || pageNumber === data.totalPages || Math.abs(pageNumber - currentPage) <= 1,
  )
  const languageName = (code: string) =>
    new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code.toUpperCase()
  const updateFilter = <Key extends 'language' | 'duration' | 'format'>(
    key: Key,
    value: SitePrayerArchiveQuery[Key],
  ) => {
    setPage(1)
    if (key === 'language') setLanguage(value as string)
    if (key === 'duration') setDuration(value as SitePrayerArchiveQuery['duration'])
    if (key === 'format') setFormat(value as SitePrayerArchiveQuery['format'])
  }

  // One section rhythm per breakpoint: 24px mobile, 32px tablet, 36px desktop.
  return (
    <BoxContainer containerClassName="flex flex-col gap-6 py-6 md:gap-8 md:py-8 lg:gap-9">
      <header
        className="relative isolate overflow-hidden rounded-2xl p-5 shadow-[0_1px_2px_0_#0000000D,-1px_-1px_2px_0_#FFFFFF] sm:p-6"
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
                {data.selectedChurchName ?? fixedChurchName ?? t('prayerArchiveChurchContext')}
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

        <div className="relative z-20 mt-4">
          <label className="relative block">
            <span className="sr-only">{t('prayerArchiveSearch')}</span>
            <SearchOutlined className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              className="h-12 w-full rounded-lg border border-neutral-400 bg-white pl-10 pr-4 text-sm text-primary-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-300/30"
              onChange={(event) => {
                setSearch(event.target.value)
              }}
              placeholder={t('prayerArchiveSearch')}
              type="search"
              value={search}
            />
          </label>
        </div>
      </header>

      <ConfigProvider theme={siteFilterTheme}>
        <div className="grid gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_2px_#0000000D] sm:grid-cols-3">
          <FilterSelect
            id="prayer-filter-language"
            label={t('prayerArchiveLanguage')}
            onChange={(value) => updateFilter('language', value ?? '')}
            options={data.languages.map((code) => ({ value: code, label: languageName(code) }))}
            placeholder={t('prayerArchiveAllLanguages')}
            value={language || undefined}
          />
          <FilterSelect
            id="prayer-filter-duration"
            label={t('prayerArchiveDuration')}
            onChange={(value) =>
              updateFilter('duration', (value ?? 'all') as SitePrayerArchiveQuery['duration'])
            }
            options={[
              { value: 'short', label: t('prayerArchiveDurationShort') },
              { value: 'medium', label: t('prayerArchiveDurationMedium') },
              { value: 'long', label: t('prayerArchiveDurationLong') },
            ]}
            placeholder={t('prayerArchiveAnyDuration')}
            value={duration === 'all' ? undefined : duration}
          />
          <FilterSelect
            id="prayer-filter-format"
            label={t('prayerArchiveFormat')}
            onChange={(value) =>
              updateFilter('format', (value ?? 'all') as SitePrayerArchiveQuery['format'])
            }
            options={[
              { value: 'audio', label: t('prayerArchiveAudio') },
              { value: 'text', label: t('prayerArchiveText') },
            ]}
            placeholder={t('prayerArchiveAllFormats')}
            value={format === 'all' ? undefined : format}
          />
        </div>
      </ConfigProvider>

      {!data.selectedChurchId ? (
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
          {data.featured && (
            <FeaturedPrayer
              eyebrow={t('prayerArchiveFeatured')}
              prayer={data.featured}
              userId={userId}
            />
          )}

          <section aria-labelledby="prayer-collection-title">
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

            <div aria-busy={loading} className={loading ? 'opacity-60 transition-opacity' : ''}>
              {data.result.length ? (
                <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {data.result.map((prayer) => (
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
            </div>
          </section>

          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <p className="text-xs text-neutral-600">
              {t('prayerArchiveShowing', { from, to, total: data.total })}
            </p>
            <div className="flex items-center gap-2">
              {currentPage > 1 && (
                <button
                  aria-label={t('prayerArchivePrevious')}
                  className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white"
                  onClick={() => setPage(currentPage - 1)}
                  type="button"
                >
                  ‹
                </button>
              )}
              {pageNumbers.map((pageNumber, index) => (
                <span className="contents" key={pageNumber}>
                  {index > 0 && pageNumbers[index - 1] !== pageNumber - 1 && (
                    <span className="text-neutral-500">…</span>
                  )}
                  <button
                    aria-current={pageNumber === currentPage ? 'page' : undefined}
                    className={`flex size-8 items-center justify-center rounded-lg border text-xs ${pageNumber === currentPage ? 'border-primary-500 bg-primary-500 text-white' : 'border-neutral-200 bg-white text-primary-900'}`}
                    onClick={() => setPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                </span>
              ))}
              {currentPage < data.totalPages && (
                <button
                  aria-label={t('prayerArchiveNext')}
                  className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white"
                  onClick={() => setPage(currentPage + 1)}
                  type="button"
                >
                  ›
                </button>
              )}
            </div>
          </nav>

          <section className="rounded-2xl bg-[linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0.45)_100%)] p-4 shadow-[0_4px_24px_-4px_#005CAD0F,0_1px_2px_0_#0000000D,-1px_-1px_2px_0_#FFFFFF]">
            <div className="flex flex-col justify-between gap-5 rounded-xl bg-primary-100 p-4 lg:flex-row lg:items-center">
              <div className="flex gap-4 sm:gap-6">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-500">
                  <MaskIcon className="bg-white" size={22} src="/icons/Icon-giving.svg" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-800">
                    {t('prayerArchiveStewardshipLabel')}
                  </p>
                  <h2 className="font-font_text text-lg font-semibold leading-[1.5] text-primary-900 sm:text-xl">
                    {t('donateTitle')}
                  </h2>
                  <p className="mt-2 font-font_text text-base font-normal leading-6 text-neutral-600">
                    {t('donateFormSubtitle')}
                  </p>
                </div>
              </div>
              <Link
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary-600 bg-primary-500 px-6 text-base font-medium text-white lg:w-[266px]"
                href="/giving"
              >
                {t('headerGiving')}
                <MaskIcon className="bg-white" size={18} src="/icons/Icon-arrow-right.svg" />
              </Link>
            </div>
          </section>
        </>
      )}
    </BoxContainer>
  )
}
