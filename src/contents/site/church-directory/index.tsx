'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Pagination, Select, Typography } from 'antd'
import {
  AimOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  MinusOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { BalticBadgeIcon } from '@/components/icon/baltic-badge'
import { ChurchIcon } from '@/components/icon/church'
import { PointerIcon } from '@/components/icon/pointer'
import { CompassIcon } from '@/components/icon/compass'
import { LayersIcon } from '@/components/icon/layers'
import { DonationBanner } from '@/components/site/donation-banner'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useSiteChurches } from '@/hooks/data/site/churches'
import { useSiteHome } from '@/hooks/data/site/home'
import { MobileChurchSummary } from '@/models/mobile'
import ChurchCard from './church-card'
import { GoogleMapPins } from '@/components/common/google-map'
import MapPreviewCard from './map-preview-card'
import { DENOMINATION_OPTIONS, LANGUAGE_OPTIONS, RADIUS_OPTIONS } from '@/utils/constant'

const DEFAULT_COORDS = { latitude: 59.437, longitude: 24.754 }
export function ChurchCardSkeleton({ featured }: { featured?: boolean }) {
  return (
    <article
      className={`flex flex-col rounded-2xl bg-white animate-pulse ${
        featured
          ? 'shadow-[0_12px_36px_-8px_rgba(0,92,173,0.08)] ring-2 ring-inset ring-primary_color/30'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
      }`}
    >
      {/* Header: left pill, right distance */}
      <div className="flex items-center justify-between gap-2 p-4">
        <div
          className={`h-6 rounded-full ${featured ? 'w-28 bg-[#B9D8F8]' : 'w-24 bg-slate-200'}`}
        />
        <div className="ml-auto h-4 w-20 rounded bg-slate-200" />
      </div>

      {/* Body: Thumbnail + Info */}
      <div className="flex items-start gap-4 border-b border-[#DDE0E4] px-4 pb-4">
        <div className="h-20 w-20 shrink-0 rounded-xl bg-slate-200 shadow-sm sm:h-24 sm:w-24" />
        <div className="flex flex-1 flex-col justify-between self-stretch gap-1">
          <div>
            <div className="h-5 w-44 rounded bg-slate-200" />
            <div className="mt-1.5 h-3.5 w-32 rounded bg-slate-100" />
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-slate-200" />
              <div className="h-3.5 w-28 rounded bg-slate-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-slate-200" />
              <div className="h-3.5 w-48 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 p-4">
        {featured && <div className="h-14 w-full rounded-lg bg-[#FAFAFB]" />}
        <div className="flex items-center justify-between gap-4">
          <div className="h-3.5 w-40 rounded bg-slate-100" />
          <div className="h-4 w-24 rounded bg-slate-200" />
        </div>
        {featured && (
          <div className="pt-1">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <div className="h-10 w-28 rounded-xl bg-slate-200" />
              <div className="h-10 w-36 rounded-xl bg-slate-100" />
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

export function MapPreviewCardSkeleton() {
  return (
    <div className="mt-3 rounded-2xl border border-[#ECEEF0] bg-white/95 p-4 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] backdrop-blur animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-slate-200" />
          <div className="flex flex-col gap-1.5">
            <div className="h-5 w-36 rounded bg-slate-200" />
            <div className="h-3.5 w-24 rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-8 w-16 shrink-0 rounded-lg bg-slate-200" />
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
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string>()
  const [mapZoom, setMapZoom] = useState(13)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>()
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap')
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

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }
          setUserCoords(coords)
          setMapCenter({ lat: coords.latitude, lng: coords.longitude })
        },
        () => {
          // Permission denied or unavailable; keep fallback to DEFAULT_COORDS
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      )
    }
  }, [])

  const coords = userCoords ?? DEFAULT_COORDS
  const { data, total, loading, error, retry } = useSiteChurches({
    search,
    radius_km: radiusKm,
    // Distance is calculated based on user location; falls back to default region center if denied/unavailable.
    latitude: coords.latitude,
    longitude: coords.longitude,
    denomination,
    language,
    page,
  })

  const { data: homeData } = useSiteHome()
  const mainChurchId = homeData?.mainChurch?.id

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

  const orderedChurches = useMemo(() => {
    if (!data) return []
    if (!mainChurchId) return data
    const primaryIndex = data.findIndex((c) => c.id === mainChurchId)
    if (primaryIndex <= 0) return data
    const primary = data[primaryIndex]
    return [primary, ...data.slice(0, primaryIndex), ...data.slice(primaryIndex + 1)]
  }, [data, mainChurchId])

  const activeId = selectedId ?? orderedChurches[0]?.id
  const selectedChurch = orderedChurches.find((c) => c.id === activeId)
  const mapRegion = [selectedChurch?.district, selectedChurch?.city].filter(Boolean).join(', ')

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

            {total !== undefined ? (
              <div className="flex shrink-0 items-center gap-1 text-xs text-[#5B6370]">
                <CheckCircleOutlined
                  className="text-[12px] text-primary_color"
                  aria-hidden="true"
                />
                <span>
                  {total} {t('congregationsListed')}
                </span>
              </div>
            ) : loading || isDebouncing ? (
              <div className="h-4 w-40 rounded-full bg-slate-200/80 animate-pulse" />
            ) : null}
          </div>

          {/* Search row */}
          <div className="flex flex-col gap-2 pt-4 lg:flex-row">
            <Input
              className="!h-12 !py-0 rounded-lg lg:flex-1 border-[#5C6370] bg-white hover:border-[#5C6370] focus:border-primary_color focus:shadow-none [&_.ant-input]:text-sm [&_.ant-input]:text-[#393E46]"
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
                if (trimmed === search) {
                  retry()
                } else {
                  setSearch(trimmed)
                  setPage(1)
                }
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
              className="h-12 w-full lg:w-[195px] [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#5C6370] [&_.ant-select-content]:text-sm [&_.ant-select-content]:text-[#0E203E]"
            />

            {/* Denomination combo: presets + free-typed custom values (e.g.
                "Lutheran (EELK)"). Tags mode takes an array value; the last
                entry wins and an empty array clears the filter. */}
            <Select
              aria-label={t('allDenominations')}
              value={denomination ? [denomination] : []}
              mode="tags"
              maxCount={1}
              onChange={(vals) => {
                const list = vals as string[]
                setDenomination(list[list.length - 1] || undefined)
                setPage(1)
              }}
              placeholder={denomination ? undefined : t('allDenominations')}
              prefix={<ChurchIcon className="text-[20px] text-[#0E203E]" />}
              options={denominationOptions}
              className="h-12 w-full lg:w-[231px] [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#5C6370] [&_.ant-select-content]:text-sm [&_.ant-select-content]:text-[#0E203E] [&_.ant-select-placeholder]:text-sm [&_.ant-select-content]:!py-2"
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
                className="h-8 min-w-[130px] [&_.ant-select-selector]:!h-8 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-content]:text-xs [&_.ant-select-content]:text-[#22252A]"
              />
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
                  <ChurchCardSkeleton key={i} featured={i === 0} />
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
                  {orderedChurches.map((c: MobileChurchSummary) => (
                    <ChurchCard key={c.id} church={c} featured={c.id === mainChurchId} />
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
            <div className="relative h-[620px] w-full overflow-hidden rounded-2xl border border-[#ECEEF0] bg-[#F4F8FA] shadow-[0_4px_24px_-4px_rgba(0,92,173,0.12)] lg:h-[720px]">
              <GoogleMapPins
                points={orderedChurches.flatMap((c) =>
                  c.latitude != null && c.longitude != null
                    ? [{ id: c.id, latitude: c.latitude, longitude: c.longitude, label: c.name }]
                    : [],
                )}
                activeId={activeId}
                onSelect={setSelectedId}
                zoom={mapZoom}
                center={mapCenter}
                mapTypeId={mapType}
                allowEmpty
                customMarkers
                className="h-full w-full"
              />

              {/* Top-Left Floating Header Badge */}
              <div className="pointer-events-none absolute left-4 top-4 z-10">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#ECEEF0] bg-white/90 px-3.5 py-1.5 shadow-sm backdrop-blur-md">
                  <CompassIcon className="text-[13px] text-[#2F7AD2]" aria-hidden="true" />
                  <span className="text-[11px] font-bold tracking-wider text-[#414752] uppercase">
                    {mapRegion ? `${mapRegion} • ` : ''}
                    {t('sanctuaryMap')}
                  </span>
                </div>
              </div>

              {/* Top-Right Floating Controls */}
              <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2.5">
                {/* Zoom Controls */}
                <div className="flex flex-col overflow-hidden rounded-xl border border-[#ECEEF0] bg-white/95 shadow-md backdrop-blur-md">
                  <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={() => setMapZoom((z) => Math.min(z + 1, 18))}
                    className="flex h-9 w-9 items-center justify-center text-slate-700 transition hover:bg-slate-50 hover:text-primary_color"
                  >
                    <PlusOutlined className="text-sm font-bold" />
                  </button>
                  <div className="h-[1px] w-full bg-[#ECEEF0]" />
                  <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={() => setMapZoom((z) => Math.max(z - 1, 4))}
                    className="flex h-9 w-9 items-center justify-center text-slate-700 transition hover:bg-slate-50 hover:text-primary_color"
                  >
                    <MinusOutlined className="text-sm font-bold" />
                  </button>
                </div>

                {/* Center on My Location */}
                <button
                  type="button"
                  aria-label="Center on my location"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const coords = {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                          }
                          setUserCoords(coords)
                          setMapCenter({ lat: coords.latitude, lng: coords.longitude })
                          setMapZoom(13)
                        },
                        () => {
                          setMapCenter({
                            lat: DEFAULT_COORDS.latitude,
                            lng: DEFAULT_COORDS.longitude,
                          })
                        },
                      )
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECEEF0] bg-white/95 text-slate-700 shadow-md backdrop-blur-md transition hover:bg-slate-50 hover:text-primary_color"
                >
                  <AimOutlined className="text-base" />
                </button>

                {/* Toggle Layer */}
                <button
                  type="button"
                  aria-label="Toggle map layer"
                  onClick={() => setMapType((t) => (t === 'roadmap' ? 'hybrid' : 'roadmap'))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECEEF0] bg-white/95 text-slate-700 shadow-md backdrop-blur-md transition hover:bg-slate-50 hover:text-primary_color"
                >
                  <LayersIcon className="text-base" />
                </button>
              </div>

              {/* Floating Interactive Parish Preview Card (Bottom Anchor) */}
              {loading || isDebouncing ? (
                <div className="absolute bottom-3 left-3 right-3 z-20 sm:bottom-4 sm:left-4 sm:right-4">
                  <MapPreviewCardSkeleton />
                </div>
              ) : selectedChurch ? (
                <div className="absolute bottom-3 left-3 right-3 z-20 sm:bottom-4 sm:left-4 sm:right-4">
                  <MapPreviewCard church={selectedChurch} />
                </div>
              ) : null}
            </div>
          </div>
        </section>
        {/* Donation banner */}
        <DonationBanner
          body={t('directoryDonationBannerBody')}
          ctaLabel={t('directoryDonationBannerCta')}
          href="/donate"
        />
      </div>
    </div>
  )
}
