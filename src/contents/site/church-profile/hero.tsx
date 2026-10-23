'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CheckOutlined, LoadingOutlined, ShareAltOutlined } from '@ant-design/icons'
import { BookmarkPlusIcon } from '@/components/icon/bookmark-plus'
import { ChurchIcon } from '@/components/icon/church'
import { DirectionIcon } from '@/components/icon/direction'
import { useSiteI18n } from '@/i18n/site-i18n'
import type { MobilePublicChurch } from '@/models/mobile'

interface HeroProps {
  church: MobilePublicChurch
  isPrimaryParish?: boolean
  isFollowed?: boolean
  isFollowPending?: boolean
  onToggleFollow?: () => void
  isSetMainPending?: boolean
  onSetMainChurch?: () => void
}
export function Hero({
  church,
  isPrimaryParish,
  isFollowed = false,
  isFollowPending = false,
  onToggleFollow,
  isSetMainPending = false,
  onSetMainChurch,
}: HeroProps) {
  const { t } = useSiteI18n()
  const [failedSrcs, setFailedSrcs] = useState<Record<string, boolean>>({})

  const coverSrc =
    church.coverUrl && !failedSrcs[church.coverUrl]
      ? church.coverUrl
      : !failedSrcs['/images/church.jpeg']
        ? '/images/church.jpeg'
        : null

  const destinationQuery = church.coordinates
    ? `${church.coordinates.latitude},${church.coordinates.longitude}`
    : [
        church.address?.line1,
        church.address?.city,
        church.address?.postalCode,
        church.address?.countryCode,
      ]
        .filter(Boolean)
        .join(', ')

  const directionsHref = destinationQuery
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`
    : '#'

  const metaParts: string[] = []
  if (church.distanceKm !== null && church.distanceKm !== undefined) {
    metaParts.push(`${church.distanceKm} km`)
  }
  const addressSummary = [church.address?.line1, church.address?.city].filter(Boolean).join(', ')
  if (addressSummary) {
    metaParts.push(addressSummary)
  }

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  return (
    <div className="relative min-h-[380px] w-full overflow-hidden bg-[#0B4497] lg:min-h-[520px]">
      {/* Background Image / Fallback Gradient */}
      {coverSrc ? (
        <Image
          src={coverSrc}
          alt={church.name}
          fill
          priority
          unoptimized
          className="object-cover"
          onError={() => {
            setFailedSrcs((prev) => ({ ...prev, [coverSrc]: true }))
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0E203E]/60 to-[#0E203E]" />
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/25" />

      {/* Top action bar */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-3 sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/45 sm:h-12 sm:w-12"
        >
          <ShareAltOutlined className="text-base sm:text-lg" />
        </button>
      </div>

      {/* Bottom-anchored content */}
      <div className="relative z-10 mx-auto flex max-w-[1152px] flex-col justify-end px-4 pb-8 pt-24 sm:px-6 sm:pb-10 lg:pt-48">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-[720px] space-y-3">
            {/* Eyebrow pills */}
            <div className="flex flex-wrap items-center gap-2">
              {church.denomination && (
                <span className="inline-flex items-center rounded-full bg-[#B9D8F8] px-3 py-1 text-xs font-semibold text-[#0B4497]">
                  {church.denomination}
                </span>
              )}
              {isPrimaryParish && (
                <span className="inline-flex items-center rounded-full bg-[#E6EDFB] px-3 py-1 text-xs font-semibold text-[#0B4497]">
                  {t('primaryParish')}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {church.name}
            </h1>

            {/* Secondary line: city + denomination */}
            {(church.address?.city || church.denomination) && (
              <p className="text-xs text-[#F7F9FB] sm:text-sm">
                {[church.address?.city, church.denomination].filter(Boolean).join(' • ')}
              </p>
            )}

            {/* Native name / tagline in quote serif italic */}
            {church.denomination && (
              <p className="font-font_quote text-base italic text-[#D0E4FF] sm:text-lg">
                {church.denomination}
              </p>
            )}

            {/* Description */}
            {church.description && (
              <p className="text-base font-normal leading-relaxed text-white/95 sm:text-lg lg:text-xl">
                {church.description}
              </p>
            )}

            {/* Meta row */}
            {metaParts.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-[#D0E4FF] sm:text-sm">
                {metaParts.map((part, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span>•</span>}
                    <span>{part}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions: Follow and Directions */}
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {onToggleFollow && (
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={isFollowPending || isPrimaryParish}
                aria-pressed={isFollowed}
                aria-label={
                  isFollowed
                    ? t('profileUnfollowAria', { church: church.name })
                    : t('profileFollow')
                }
                title={isPrimaryParish ? t('primaryParish') : undefined}
                className={
                  isFollowed
                    ? 'inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 bg-black/30 px-5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-75 sm:text-base'
                    : 'inline-flex h-12 items-center gap-2 rounded-xl bg-[#2F7AD2] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2066B7] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base'
                }
              >
                {isFollowPending ? (
                  <LoadingOutlined className="text-base" />
                ) : isFollowed ? (
                  <CheckOutlined className="text-base" />
                ) : (
                  <BookmarkPlusIcon className="h-5 w-5" />
                )}
                <span>{isFollowed ? t('profileFollowing') : t('profileFollow')}</span>
              </button>
            )}
            {onSetMainChurch && (
              <button
                type="button"
                onClick={onSetMainChurch}
                disabled={isSetMainPending || isPrimaryParish}
                aria-pressed={isPrimaryParish}
                aria-label={isPrimaryParish ? t('mainChurch') : t('setAsMainChurch')}
                title={isPrimaryParish ? t('primaryParish') : undefined}
                className={
                  isPrimaryParish
                    ? 'inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 bg-black/30 px-5 text-sm font-semibold text-white backdrop-blur-md transition-colors sm:text-base opacity-75 cursor-default'
                    : 'inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 bg-black/30 px-5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base'
                }
              >
                {isSetMainPending ? (
                  <LoadingOutlined className="text-base" />
                ) : isPrimaryParish ? (
                  <CheckOutlined className="text-base" />
                ) : (
                  <ChurchIcon className="text-base" />
                )}
                <span>{isPrimaryParish ? t('mainChurch') : t('setAsMainChurch')}</span>
              </button>
            )}
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-white px-5 text-sm font-semibold text-[#0E203E] shadow-sm transition-colors hover:bg-[#F7F9FB] sm:text-base"
            >
              <DirectionIcon className="text-lg text-[#0E203E]" />
              <span>{t('directions')}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
