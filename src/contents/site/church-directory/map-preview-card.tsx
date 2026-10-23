'use client'

import Image from 'next/image'
import Link from 'next/link'
import { UserTieIcon } from '@/components/icon/user-tie'
import { useSiteI18n } from '@/i18n/site-i18n'
import { formatDenomination } from '@/utils/denomination'
import { ChurchIcon } from '@/components/icon/church'
import { DirectionIcon } from '@/components/icon/direction'
import { CalendarWeekIcon } from '@/components/icon/calendar-week'
import { VerifyIcon } from '@/components/icon/verify'
import { formatServiceTime } from '@/utils/service-time'
import type { MobileChurchSummary } from '@/models/mobile'

export default function MapPreviewCard({ church }: { church: MobileChurchSummary }) {
  const { t } = useSiteI18n()
  const denomination = formatDenomination(church.denomination)
  const addressText = church.addressLine1 ?? church.district ?? church.city
  const distanceText = church.distanceKm != null ? `${church.distanceKm} km away` : null
  const accessibility =
    church.accessibility && church.accessibility.length > 0
      ? church.accessibility.join(' & ')
      : null

  const destination =
    church.latitude != null && church.longitude != null
      ? `${church.latitude},${church.longitude}`
      : encodeURIComponent(
          [church.name, church.addressLine1, church.district, church.city]
            .filter(Boolean)
            .join(', '),
        )
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`

  return (
    <div className="rounded-2xl border border-[#ECEEF0] bg-white/95 p-4 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] backdrop-blur-xl transition font-font_text">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100 shadow-xs">
            {church.coverUrl ? (
              <Image
                src={church.coverUrl}
                alt={church.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-blue-50 text-base font-bold text-primary_color">
                {church.name.charAt(0)}
              </div>
            )}
          </div>

          {/* Title & subtitle */}
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-bold leading-tight text-[#0D203E]">
                {church.name}
              </span>
              <VerifyIcon className="text-[13px] text-primary_color" aria-hidden="true" />
              {denomination && (
                <span className="rounded border border-primary_color/20 bg-blue-50/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary_color">
                  {denomination}
                </span>
              )}
            </div>
            {(addressText || distanceText) && (
              <div className="text-xs text-[#5B6370]">
                {addressText && <span>{addressText}</span>}
                {addressText && distanceText && <span> • </span>}
                {distanceText && <span>{distanceText}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Profile Button */}
        <div className="flex items-center justify-end">
          <Link
            href={church.slug ? `/churches/${church.slug}` : '#'}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-primary_color/40 bg-white px-3 text-xs font-semibold text-primary_color shadow-xs transition hover:bg-primary_color hover:text-white"
          >
            <ChurchIcon className="text-[12px]" aria-hidden="true" />
            <span>{t('profile')}</span>
          </Link>
        </div>
      </div>

      {/* Details & Action */}
      <div className="mt-3.5 flex flex-col gap-3 pt-3 border-t border-[#ECEEF0] sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1 text-xs text-[#5B6370]">
          {church.pastorName && (
            <div className="flex items-center gap-2">
              <UserTieIcon className="text-[13px] text-[#2F7AD2] shrink-0" aria-hidden="true" />
              <span>{church.pastorName}</span>
            </div>
          )}

          {church.churchStyle && (
            <div className="flex items-center gap-2">
              <CalendarWeekIcon
                className="text-[13px] text-primary_color shrink-0"
                aria-hidden="true"
              />
              <span>{church.churchStyle}</span>
            </div>
          )}

          {church.serviceTimes && (
            <div
              className={`font-font_text text-xs font-semibold leading-[150%] text-[#2F7AD2] ${
                church.churchStyle ? 'pl-5' : 'flex items-center gap-2'
              }`}
            >
              {!church.churchStyle && (
                <CalendarWeekIcon
                  className="text-[13px] text-primary_color shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>{formatServiceTime(church.serviceTimes)}</span>
            </div>
          )}

          {accessibility && (
            <div className="pl-5 text-xs text-[#5B6370]">
              <span>{accessibility}</span>
            </div>
          )}
        </div>

        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary_color px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary_color/90 self-start sm:self-auto"
        >
          <DirectionIcon className="text-[14px] text-white" aria-hidden="true" />
          <span>Start Route</span>
        </a>
      </div>
    </div>
  )
}
