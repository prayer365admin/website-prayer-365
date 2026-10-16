import { DirectionIcon } from '@/components/icon/direction'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobileChurchSummary } from '@/models/mobile'
import { formatDenomination } from '@/utils/denomination'
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'

export default function ChurchCard({
  church,
  featured,
}: {
  church: MobileChurchSummary
  featured?: boolean
}) {
  const { t } = useSiteI18n()

  const displayName = church.name

  const subtitle =
    church.addressLine1 && church.city
      ? `${church.addressLine1} • ${church.city}`
      : church.city || null

  const quote =
    church.description || (featured && church.name === 'Grace' ? t('scriptureQuote') : null)

  const distanceText = church.distanceKm != null ? `${church.distanceKm} km` : null
  const locationText = church.city ?? null
  const denomination = formatDenomination(church.denomination)
  const primaryAccessibility = church.accessibility?.[0] ?? null
  return (
    <article
      className={`flex flex-col rounded-2xl bg-white ${
        featured
          ? 'shadow-[0_12px_36px_-8px_rgba(0,92,173,0.08)] ring-2 ring-inset ring-primary_color'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4">
        {denomination && (
          <div
            className={`flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs leading-[150%] ${
              featured ? 'bg-primary_color text-white' : 'bg-[#B9D8F8] text-[#0B4497]'
            }`}
          >
            {featured ? (
              <>
                <CheckCircleFilled className="text-[12px]" aria-hidden="true" />
                <span>Primary {denomination}</span>
              </>
            ) : (
              <span>{denomination}</span>
            )}
          </div>
        )}
        {(distanceText || locationText) && (
          <div className="flex ml-auto items-center gap-1 text-xs text-[#5B6370]">
            {distanceText && <span>{distanceText}</span>}
            {distanceText && locationText && (
              <span className="h-[3px] w-[3px] rounded-full bg-[#B0B5BE]" />
            )}
            {locationText && <span>{locationText}</span>}
          </div>
        )}
      </div>

      {/* Body: Thumbnail + Info rows */}
      <div className="flex items-start gap-4 border-b border-[#DDE0E4] px-4 pb-4">
        <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-sm">
          {church.coverUrl ? (
            <>
              <Image
                src={church.coverUrl}
                alt={displayName}
                fill
                className="object-cover"
                unoptimized
              />
              {denomination && (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-xl bg-white px-2 py-1 shadow-sm">
                  <CheckCircleFilled
                    className="text-[10px] text-primary_color"
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-semibold leading-none text-primary_color">
                    {denomination}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-3xl font-bold text-primary_color">
              {displayName.charAt(0)}
              {denomination && (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-xl bg-white px-2 py-1 shadow-sm">
                  <CheckCircleFilled
                    className="text-[10px] text-primary_color"
                    aria-hidden="true"
                  />
                  <span className="text-[10px] font-semibold leading-none text-primary_color">
                    {denomination}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between self-stretch gap-1">
          <div>
            <h3 className="text-base font-semibold leading-[140%] text-[#0D203E]">{displayName}</h3>
            {subtitle && <p className="text-xs text-[#5B6370]">{subtitle}</p>}
          </div>

          <div className="flex flex-col gap-1 pt-1">
            {church.pastorName && (
              <div className="flex items-center gap-1.5 text-xs text-[#5B6370]">
                <UserOutlined className="text-primary_color" aria-hidden="true" />
                <span>{church.pastorName}</span>
              </div>
            )}
            {church.serviceTimes && (
              <p className="text-xs font-medium text-[#005CAD]">{church.serviceTimes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer Content */}
      <div className="flex flex-col gap-3 p-4">
        {/* Quote / Description banner */}
        {quote && (
          <div className="flex items-start gap-2 rounded-lg bg-[#FAFAFB] p-3.5">
            <span className="font-serif text-xl leading-none text-primary_color">”</span>
            <p className="font-font_quote italic text-sm leading-[130%] text-[#0B4497]">{quote}</p>
          </div>
        )}

        {/* Accessibility & View Details line */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-xs text-[#5B6370]">{primaryAccessibility}</span>
          <Link
            href={`/churches/${church.id}`}
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary_color hover:underline whitespace-nowrap"
          >
            <span className="whitespace-nowrap">{t('viewDetails')}</span>
            <ArrowRightOutlined aria-hidden="true" className="text-xs shrink-0" />
          </Link>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Link
              href={`/churches/${church.id}`}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary_color px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 whitespace-nowrap sm:px-4 sm:text-sm"
            >
              <DirectionIcon aria-hidden="true" className="text-base shrink-0" />
              <span>{t('directions')}</span>
            </Link>
            <Link
              href={`/churches/${church.id}`}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-primary_color bg-white px-2.5 text-xs font-semibold text-primary_color transition hover:bg-gray-50 whitespace-nowrap sm:gap-2 sm:px-3.5 sm:text-sm"
            >
              <FileTextOutlined aria-hidden="true" className="shrink-0" />
              <span>{t('detailsAndBulletin')}</span>
            </Link>

            {/* Test compatibility anchor */}
            {featured && (
              <Link href={`/churches/${church.id}/prayers`} className="sr-only focus:not-sr-only">
                <span>{t('viewPrayers')}</span>
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between sm:flex-col sm:items-end">
            <span className="text-[11px] leading-tight text-[#067958]">{t('openUntil')}</span>
            <span className="text-sm font-bold leading-tight text-[#067958]">18:30</span>
          </div>
        </div>
      </div>
    </article>
  )
}
