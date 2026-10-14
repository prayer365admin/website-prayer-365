'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Pagination, Select, Typography } from 'antd'
import {
  CheckCircleOutlined,
  LoadingOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { BalticBadgeIcon } from '@/components/icon/baltic-badge'
import { ChurchIcon } from '@/components/icon/church'
import { MusicIcon } from '@/components/icon/music'
import { OpenPrayerIcon } from '@/components/icon/open-prayer'
import { PointerIcon } from '@/components/icon/pointer'
import { SundayLivestreamIcon } from '@/components/icon/sunday-livestream'
import { YouthMinistryIcon } from '@/components/icon/youth-ministry'
import { FirstTimeVisitingIcon } from '@/components/icon/first-time-visiting'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useSiteChurches } from '@/hooks/data/site/churches'
import { MobileChurchSummary } from '@/models/mobile'
import ChurchCard from './church-card'
import SanctuaryMap from './sanctuary-map'
import { DENOMINATION_OPTIONS, LANGUAGE_OPTIONS, RADIUS_OPTIONS } from '@/utils/constant'

const DEFAULT_COORDS = { latitude: 59.437, longitude: 24.754 }
function ChurchCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-[#ECEEF0] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] animate-pulse">
      <div className="flex items-center justify-between pb-3">
        <div className="h-5 w-28 rounded-full bg-slate-200" />
        <div className="h-4 w-16 rounded bg-slate-200" />
      </div>
      <div className="flex items-start gap-4 border-b border-[#DDE0E4] pb-4">
        <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-2xl bg-slate-200" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <div className="h-6 w-48 rounded bg-slate-200" />
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-3.5 w-40 rounded bg-slate-100" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-3">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-slate-100" />
          <div className="h-8 w-24 rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

export default function ContentsSiteChurchDirectory() {
  const { t } = useSiteI18n()
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState<string>()
  const [radiusKm, setRadiusKm] = useState<number>()
  const [denomination, setDenomination] = useState<string>()
  const [language, setLanguage] = useState<string>()
  const [openNow, setOpenNow] = useState<boolean>()
  const [sundayLiveStream, setSundayLiveStream] = useState<boolean>()
  const [taizeChants, setTaizeChants] = useState<boolean>()
  const [youthMinistry, setYouthMinistry] = useState<boolean>()
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string>()

  const isDebouncing = (inputValue.trim() || undefined) !== search

  useEffect(() => {
    const trimmed = inputValue.trim() || undefined
    if (trimmed === search) return
    const timer = setTimeout(() => {
      setSearch(trimmed)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [inputValue, search])
  const { data, total, loading, error, retry } = useSiteChurches({
    search,
    radius_km: radiusKm,
    latitude: radiusKm !== undefined ? DEFAULT_COORDS.latitude : undefined,
    longitude: radiusKm !== undefined ? DEFAULT_COORDS.longitude : undefined,
    denomination,
    language,
    open_now: openNow,
    sunday_live_stream: sundayLiveStream,
    taize_chants: taizeChants,
    youth_ministry: youthMinistry,
    page,
  })

  const radiusOptions = useMemo(
    () => [{ value: '', label: t('withinDistance') }, ...RADIUS_OPTIONS],
    [t],
  )
  const denominationOptions = useMemo(
    () => [{ value: '', label: t('allDenominations') }, ...DENOMINATION_OPTIONS],
    [t],
  )
  const languageOptions = useMemo(
    () => [{ value: '', label: t('allLanguages') }, ...LANGUAGE_OPTIONS],
    [t],
  )

  return (
    <div className="bg-[#F7F9FB]">
      <div className="mx-auto flex max-w-[1152px] flex-col gap-6 px-6 pt-8 pb-16">
        {/* Hero banner */}
        <section className="isolate relative overflow-hidden rounded-2xl p-6 shadow-[-1px_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)] [background-image:linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%)] bg-white">
          {/* Decorative blur circle */}
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-24 h-96 w-96 rounded-full [background:linear-gradient(135deg,rgba(131,192,255,0.2)_0%,rgba(0,92,173,0.05)_100%)] blur-2xl"
          />

          {/* Inner panel */}
          <div className="relative flex flex-col justify-between gap-4 rounded-lg bg-[#F5F7FF] p-4 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-semibold text-[#0B4497] shadow-sm">
                  <BalticBadgeIcon className="text-[12px] text-[#2F7AD2]" aria-hidden="true" />
                  <span>{t('heroEyebrow')}</span>
                </span>
                <div className="flex items-center gap-1 text-xs text-[#5B6370]">
                  <span>{t('heroRegion')}</span>
                </div>
              </div>
              <h1 className="font-font_heading text-[32px] font-bold leading-none tracking-[-1px] text-[#191C1E]">
                {t('directoryTitle')}
              </h1>
              <p className="text-base text-[#5B6370]">{t('heroSubtitle')}</p>
            </div>

            {total !== undefined && (
              <div className="flex shrink-0 items-center gap-1 text-xs text-[#5B6370]">
                <CheckCircleOutlined
                  className="text-[12px] text-primary_color"
                  aria-hidden="true"
                />
                <span>
                  {total} {t('congregationsListed')}
                </span>
              </div>
            )}
          </div>

          {/* Search row */}
          <div className="flex flex-col gap-2 pt-4 lg:flex-row">
            <Input
              className="!h-12 min-h-[48px] flex-1 rounded-lg border-[#5C6370] bg-white px-3 text-sm text-[#393E46] hover:border-[#5C6370] focus:border-primary_color focus:shadow-none [&_.ant-input]:text-sm [&_.ant-input]:text-[#393E46]"
              prefix={
                <SearchOutlined className="mr-1 text-[16px] text-[#0E203E]" aria-hidden="true" />
              }
              suffix={
                isDebouncing || loading ? (
                  <LoadingOutlined className="text-sm text-primary_color" />
                ) : null
              }
              placeholder={t('searchPlaceholder')}
              allowClear
              value={inputValue}
              onChange={(e) => {
                const val = e.target.value
                setInputValue(val)
                if (!val) {
                  setSearch(undefined)
                  setPage(1)
                }
              }}
              onPressEnter={() => {
                const trimmed = inputValue.trim() || undefined
                setSearch(trimmed)
                setPage(1)
              }}
            />

            {/* Distance radius select */}
            <Select
              aria-label={t('withinDistance')}
              value={radiusKm ?? ''}
              onChange={(val) => {
                setRadiusKm(val ? Number(val) : undefined)
                setPage(1)
              }}
              prefix={<PointerIcon className="text-[20px] text-[#0E203E]" />}
              options={radiusOptions}
              className="h-12 w-full lg:w-[195px] [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#5C6370] [&_.ant-select-selection-item]:text-sm [&_.ant-select-selection-item]:text-[#0E203E]"
            />

            {/* Denomination select */}
            <Select
              aria-label={t('allDenominations')}
              value={denomination ?? ''}
              onChange={(val) => {
                setDenomination(val ? String(val) : undefined)
                setPage(1)
              }}
              prefix={<ChurchIcon className="text-[20px] text-[#0E203E]" />}
              options={denominationOptions}
              className="h-12 w-full lg:w-[231px] [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#5C6370] [&_.ant-select-selection-item]:text-sm [&_.ant-select-selection-item]:text-[#0E203E]"
            />
          </div>

          {/* Quick filters row */}
          <div className="flex flex-col gap-3 pt-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[#737C8C]">
                {t('quickFilters')}
              </span>

              {/* Language select */}
              <Select
                aria-label={t('allLanguages')}
                value={language ?? ''}
                onChange={(val) => {
                  setLanguage(val ? String(val) : undefined)
                  setPage(1)
                }}
                options={languageOptions}
                className="h-8 min-w-[130px] [&_.ant-select-selector]:!h-8 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:text-xs [&_.ant-select-selection-item]:text-[#22252A]"
              />
            </div>

            {/* Interactive chip group matching [Image #1] */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={Boolean(openNow)}
                onClick={() => {
                  setOpenNow((prev) => (prev ? undefined : true))
                  setPage(1)
                }}
                className={`flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-2xl pl-2.5 pr-3.5 py-1.5 text-xs transition-colors ${
                  openNow
                    ? 'bg-primary_color font-semibold text-white shadow-sm'
                    : 'border border-[#DDE0E4] bg-white text-[#5B6370] hover:border-[#5C6370]'
                }`}
              >
                <OpenPrayerIcon className="text-[14px]" />
                <span>{t('openForPrayerNow')}</span>
              </button>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <button
                  type="button"
                  aria-pressed={Boolean(sundayLiveStream)}
                  onClick={() => {
                    setSundayLiveStream((prev) => (prev ? undefined : true))
                    setPage(1)
                  }}
                  className={`flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-2xl pl-2.5 pr-3.5 py-1.5 text-xs transition-colors ${
                    sundayLiveStream
                      ? 'bg-primary_color font-semibold text-white shadow-sm'
                      : 'border border-[#DDE0E4] bg-white text-[#5B6370] hover:border-[#5C6370]'
                  }`}
                >
                  <SundayLivestreamIcon className="text-[14px]" />
                  <span>{t('sundayLiveStream')}</span>
                </button>

                <button
                  type="button"
                  aria-pressed={Boolean(taizeChants)}
                  onClick={() => {
                    setTaizeChants((prev) => (prev ? undefined : true))
                    setPage(1)
                  }}
                  className={`flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-2xl pl-2.5 pr-3.5 py-1.5 text-xs transition-colors ${
                    taizeChants
                      ? 'bg-primary_color font-semibold text-white shadow-sm'
                      : 'border border-[#DDE0E4] bg-white text-[#5B6370] hover:border-[#5C6370]'
                  }`}
                >
                  <MusicIcon className="text-[14px]" />
                  <span>{t('taizeChants')}</span>
                </button>
              </div>

              <button
                type="button"
                aria-pressed={Boolean(youthMinistry)}
                onClick={() => {
                  setYouthMinistry((prev) => (prev ? undefined : true))
                  setPage(1)
                }}
                className={`flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-2xl pl-2.5 pr-3.5 py-1.5 text-xs transition-colors ${
                  youthMinistry
                    ? 'bg-primary_color font-semibold text-white shadow-sm'
                    : 'border border-[#DDE0E4] bg-white text-[#5B6370] hover:border-[#5C6370]'
                }`}
              >
                <YouthMinistryIcon className="text-[14px]" />
                <span>{t('youthMinistry')}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Split section */}
        <section className="grid gap-8 lg:grid-cols-[45fr_55fr]">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold leading-[150%] text-[#0D203E]">
                {t('featuredNearby')}
              </h2>
              <span className="text-base text-[#737C8C]">{t('byDistance')}</span>
            </div>

            {(loading || isDebouncing) && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ChurchCardSkeleton key={i} />
                ))}
              </div>
            )}

            {error && !loading && !isDebouncing && (
              <Alert
                type="error"
                message={t('error')}
                action={<Button onClick={() => retry()}>Retry</Button>}
              />
            )}

            {!loading && !isDebouncing && !error && data?.length === 0 && (
              <Typography.Text>{t('noChurchesFound')}</Typography.Text>
            )}

            {!loading && !isDebouncing && !error && data && data.length > 0 && (
              <>
                <div className="flex flex-col gap-4">
                  {data.map((c: MobileChurchSummary, i: number) => (
                    <ChurchCard key={c.id} church={c} featured={i === 0} />
                  ))}
                </div>

                {(total ?? 0) > 24 && (
                  <div className="mt-6 flex justify-center">
                    <Pagination
                      current={page}
                      pageSize={24}
                      total={total}
                      onChange={(p) => setPage(p)}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right column */}
          <div className="self-start lg:sticky lg:top-6">
            <SanctuaryMap
              churches={data ?? []}
              total={total}
              selectedId={selectedId ?? data?.[0]?.id}
              onSelect={setSelectedId}
            />
          </div>
        </section>

        {/* Bottom banner */}
        <section className="rounded-2xl p-4 shadow-[-1px_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)] [background-image:linear-gradient(135deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0.45)_100%)]">
          <div className="flex flex-col justify-between gap-6 rounded-xl bg-[#F5F7FF] p-4 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-4 lg:max-w-[700px]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary_color text-white shadow-sm">
                    <ChurchIcon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[#5B6370]">
                    {t('bannerEyebrow')}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#5B6370]">
                  <span className="h-[3px] w-[3px] rounded-full bg-[#B0B5BE]" />
                  <span>{t('openDoorsCharter')}</span>
                </div>
              </div>

              <blockquote className="font-font_quote italic text-[24px] leading-[120%] text-[#0D203E] sm:text-[32px]">
                {t('bannerQuote')}
              </blockquote>

              <p className="text-sm leading-relaxed text-[#5B6370] sm:text-base">
                {t('bannerSub')}
              </p>
            </div>

            <div className="flex w-full shrink-0 flex-col items-stretch gap-3 lg:w-auto lg:items-end">
              <button
                type="button"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary_color bg-white px-4 text-base font-semibold text-primary_color transition hover:bg-gray-50 lg:w-auto"
              >
                <FirstTimeVisitingIcon className="text-[20px] text-[#2F7AD2]" />
                <span>{t('firstTimeVisiting')}</span>
              </button>
              <button
                type="button"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary_color px-6 text-base font-semibold text-white transition hover:opacity-90 lg:w-auto"
              >
                <span>{t('contactPastoralCare')}</span>
                <SendOutlined />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
