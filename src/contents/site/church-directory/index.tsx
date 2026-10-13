'use client'

import { useState } from 'react'
import { Alert, Button, Input, Pagination, Skeleton, Typography } from 'antd'
import {
  ClockCircleOutlined,
  DownOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SendOutlined,
  SoundOutlined,
  StarFilled,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useSiteChurches } from '@/hooks/data/site/churches'
import { MobileChurchSummary } from '@/models/mobile'
import ChurchCard from './church-card'
import { ChurchIcon } from './church-icon'
import SanctuaryMap from './sanctuary-map'

export default function ContentsSiteChurchDirectory() {
  const { t } = useSiteI18n()
  const [search, setSearch] = useState<string>()
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string>()

  const { data, total, loading, error, retry } = useSiteChurches({
    search,
    page,
  })

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
                <span className="flex items-center gap-1 rounded-full bg-white px-4 py-1 text-xs font-semibold text-[#0B4497]">
                  <StarFilled className="text-[12px] text-primary_color" />
                  <span>{t('heroEyebrow')}</span>
                </span>
                <div className="flex items-center gap-1 text-xs text-[#5B6370]">
                  <span>{t('heroRegion')}</span>
                  <span className="h-[3px] w-[3px] rounded-full bg-[#B0B5BE]" />
                </div>
              </div>
              <h1 className="font-font_heading text-[32px] font-bold leading-none tracking-[-1px] text-[#191C1E]">
                {t('directoryTitle')}
              </h1>
              <p className="text-base text-[#5B6370]">{t('heroSubtitle')}</p>
            </div>

            {total !== undefined && (
              <div className="flex shrink-0 items-center gap-1 text-xs text-[#5B6370]">
                <SafetyCertificateOutlined className="text-[12px] text-primary_color" />
                <span>
                  {total} {t('congregationsListed')}
                </span>
              </div>
            )}
          </div>

          {/* Search row */}
          <div className="flex flex-col gap-2 pt-4 lg:flex-row">
            <Input.Search
              className="flex-1 [&_.ant-input]:h-12 [&_.ant-input-affix-wrapper]:h-12 [&_.ant-input-search-button]:h-12"
              prefix={<SearchOutlined className="text-[#0D203E]" />}
              placeholder={t('searchPlaceholder')}
              allowClear
              onSearch={(v) => {
                setSearch(v.trim() || undefined)
                setPage(1)
              }}
            />

            {/* Inert filter shells */}
            <div
              aria-hidden="true"
              className="flex h-12 select-none items-center justify-between gap-3 rounded-lg border border-[#5B6370] bg-white px-3 text-sm text-[#393E46] lg:w-[195px]"
            >
              <div className="flex items-center gap-2">
                <EnvironmentOutlined />
                <span>{t('withinDistance')}</span>
              </div>
              <DownOutlined className="text-xs text-[#5B6370]" />
            </div>

            <div
              aria-hidden="true"
              className="flex h-12 select-none items-center justify-between gap-3 rounded-lg border border-[#5B6370] bg-white px-3 text-sm text-[#393E46] lg:w-[231px]"
            >
              <div className="flex items-center gap-2">
                <ChurchIcon className="h-4 w-4 text-[#393E46]" />
                <span>{t('allDenominations')}</span>
              </div>
              <DownOutlined className="text-xs text-[#5B6370]" />
            </div>
          </div>

          {/* Quick filters row */}
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[#737C8C]">
              {t('quickFilters')}
            </span>

            {/* Language dropdown (inert) */}
            <div
              aria-hidden="true"
              className="flex h-8 select-none items-center gap-2 rounded-lg border border-[#DDE0E4] bg-white px-4 py-2 text-sm text-[#22252A]"
            >
              <span>{t('allLanguages')}</span>
              <DownOutlined className="text-xs" />
            </div>

            {/* Chip group (inert) */}
            <div aria-hidden="true" className="flex flex-wrap items-center gap-2 select-none">
              <span className="flex h-8 items-center gap-2 rounded-2xl bg-primary_color px-4 py-2 text-sm text-white">
                <VideoCameraOutlined />
                <span>{t('sundayLiveStream')}</span>
              </span>
              <span className="flex h-8 items-center gap-2 rounded-2xl border border-[#DDE0E4] bg-white px-4 py-2 text-sm text-[#5B6370]">
                <ClockCircleOutlined />
                <span>{t('openForPrayerNow')}</span>
              </span>
              <span className="flex h-8 items-center gap-2 rounded-2xl border border-[#DDE0E4] bg-white px-4 py-2 text-sm text-[#5B6370]">
                <SoundOutlined />
                <span>{t('taizeChants')}</span>
              </span>
              <span className="flex h-8 items-center gap-2 rounded-2xl border border-[#DDE0E4] bg-white px-4 py-2 text-sm text-[#5B6370]">
                <TeamOutlined />
                <span>{t('youthMinistry')}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Split section */}
        <section className="grid gap-8 lg:grid-cols-[45fr_55fr]">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold leading-[150%] text-[#0D203E]">
                {t('featuredNearby')}
              </h2>
              <span className="text-base text-[#737C8C]">{t('byDistance')}</span>
            </div>

            {loading && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[235px] rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  >
                    <Skeleton active />
                  </div>
                ))}
              </div>
            )}

            {error && !loading && (
              <Alert
                type="error"
                message={t('error')}
                action={<Button onClick={() => retry()}>Retry</Button>}
              />
            )}

            {!loading && !error && data?.length === 0 && (
              <Typography.Text>{t('noChurchesFound')}</Typography.Text>
            )}

            {!loading && !error && data && data.length > 0 && (
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
            <div className="flex items-start gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary_color text-white">
                <ChurchIcon className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[#5B6370]">
                    {t('bannerEyebrow')}
                  </span>
                  <span className="h-[3px] w-[3px] rounded-full bg-[#B0B5BE]" />
                  <span className="text-xs text-[#5B6370]">{t('openDoorsCharter')}</span>
                </div>
                <blockquote className="font-font_quote italic text-[32px] leading-[115%] text-[#0D203E]">
                  {t('bannerQuote')}
                </blockquote>
                <p className="text-base text-[#5B6370]">{t('bannerSub')}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-3 lg:items-end">
              <button
                type="button"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-primary_color px-4 text-base font-semibold text-primary_color transition hover:bg-white"
              >
                <SendOutlined />
                <span>{t('firstTimeVisiting')}</span>
              </button>
              <button
                type="button"
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary_color px-6 text-base font-semibold text-white transition hover:opacity-90"
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
