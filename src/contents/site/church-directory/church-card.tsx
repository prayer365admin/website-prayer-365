import { useSiteI18n } from '@/i18n/site-i18n'
import { MobileChurchSummary } from '@/models/mobile'
import { formatDenomination } from '@/utils/denomination'
import { CheckCircleFilled } from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarWeekIcon } from '@/components/icon/calendar-week'
import { DirectionIcon } from '@/components/icon/direction'
import { UserTieIcon } from '@/components/icon/user-tie'
import { ArrowRightTailIcon } from '@/components/icon/arrow-right-tail'
import { formatServiceTime } from '@/utils/service-time'
/** Small "✓ EELK" chip overlaid on the thumbnail, per FIGMA ChurchArticle body. */
function ThumbnailDenominationBadge({ label }: { label: string }) {
  return (
    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-xl bg-white px-2 py-1 shadow-sm">
      <CheckCircleFilled className="text-[10px] text-primary_color" aria-hidden="true" />
      <span className="text-[10px] font-semibold leading-none text-primary_color">{label}</span>
    </div>
  )
}

export default function ChurchCard({
  church,
  featured,
}: {
  church: MobileChurchSummary
  featured?: boolean
}) {
  const { t } = useSiteI18n()

  const displayName = church.name

  // FIGMA: subtitle row = native name • street address, split by a small dot.
  const subtitleLeft = church.addressLine1 ?? null
  const subtitleRight = church.city ?? null

  // FIGMA: header pill right segments = distance • district (address line2).
  const distanceText = church.distanceKm != null ? `${church.distanceKm} km` : null
  const districtText = church.district ?? null
  // FIGMA pill slot: worship-style/highlight per church ("Contemporary
  // Ecumenical", "Youth & Student Parish"). Hidden when the admin has not set
  // one — the thumbnail badge already shows the denomination acronym.
  const churchStyle = church.churchStyle ?? null
  const denomination = formatDenomination(church.denomination)
  const quote = church.description || null
  const destination =
    church.latitude != null && church.longitude != null
      ? `${church.latitude},${church.longitude}`
      : encodeURIComponent(
          [church.name, church.addressLine1, church.district, church.city]
            .filter(Boolean)
            .join(', '),
        )
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`
  const churchProfileHref = church.slug
    ? `/churches/${church.slug}`
    : church.id
      ? `/churches/${church.id}`
      : '#'
  return (
    <article
      className={`flex flex-col rounded-2xl bg-white font-font_text ${
        featured
          ? 'shadow-[0_12px_36px_-8px_rgba(0,92,173,0.08)] ring-2 ring-inset ring-primary_color'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
      }`}
    >
      {/* Header: left pill (Primary Parish / church style), right distance • district */}
      <div className="flex items-center justify-between gap-2 p-4">
        {(featured || churchStyle) && (
          <div
            className={`flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs leading-[150%] ${
              featured ? 'bg-primary_color text-white' : 'bg-[#B9D8F8] text-[#0B4497]'
            }`}
          >
            {featured ? (
              <>
                <CheckCircleFilled className="text-[12px]" aria-hidden="true" />
                <span>{t('primaryParish')}</span>
              </>
            ) : (
              <span>{churchStyle}</span>
            )}
          </div>
        )}
        {(distanceText || districtText) && (
          <div className="ml-auto flex items-center gap-2 text-right text-xs text-[#5B6370]">
            {distanceText && <span className="whitespace-nowrap">{distanceText}</span>}
            {distanceText && districtText && (
              <span className="h-[3px] w-[3px] rounded-full bg-[#B0B5BE]" />
            )}
            {districtText && <span>{districtText}</span>}
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
              {denomination && <ThumbnailDenominationBadge label={denomination} />}
            </>
          ) : (
            <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-3xl font-bold text-primary_color">
              {displayName.charAt(0)}
              {denomination && <ThumbnailDenominationBadge label={denomination} />}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between self-stretch gap-1">
          <div>
            <h3 className="text-base font-semibold leading-[140%] text-[#0D203E]">{displayName}</h3>
            {(subtitleLeft || subtitleRight) && (
              <p className="flex items-center gap-2 text-xs text-[#5B6370]">
                {subtitleLeft && <span>{subtitleLeft}</span>}
                {subtitleLeft && subtitleRight && (
                  <span className="h-[3px] w-[3px] rounded-full bg-[#B0B5BE]" />
                )}
                {subtitleRight && <span>{subtitleRight}</span>}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1 pt-1">
            {church.pastorName && (
              <div className="flex items-center gap-1.5 text-xs text-[#5B6370]">
                <UserTieIcon className="text-[13px] text-[#2F7AD2] shrink-0" aria-hidden="true" />
                <span>{church.pastorName}</span>
              </div>
            )}
            {church.serviceTimes && (
              <div className="flex items-center gap-1.5 font-font_text text-xs font-semibold leading-[150%] text-[#2F7AD2]">
                <CalendarWeekIcon className="text-[13px] shrink-0" aria-hidden="true" />
                <span>{formatServiceTime(church.serviceTimes)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: View details; featured card adds quote and
          Directions / View details rows (FIGMA 2032:2942);
          regular card stops after the View-details line (FIGMA 2032:2992). */}
      <div className="flex flex-col gap-3 p-4">
        {featured && quote && (
          <div className="flex items-start gap-2 rounded-lg bg-[#FAFAFB] p-3.5">
            <span className="font-serif text-xl leading-none text-primary_color">”</span>
            <p className="font-font_quote italic text-sm leading-[130%] text-[#0B4497]">{quote}</p>
          </div>
        )}
        {!featured && (
          <div className="flex items-center justify-end">
            <Link
              href={churchProfileHref}
              className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary_color hover:underline whitespace-nowrap ml-auto"
            >
              <span className="whitespace-nowrap">{t('viewDetails')}</span>
              <ArrowRightTailIcon aria-hidden="true" className="text-sm shrink-0" />
            </Link>
          </div>
        )}

        {featured && (
          <div className="pt-1">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary_color px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 whitespace-nowrap"
              >
                <DirectionIcon className="text-lg shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{t('directions')}</span>
              </a>
              <Link
                href={churchProfileHref}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-primary_color bg-white px-4 text-sm font-semibold text-primary_color transition hover:bg-gray-50 whitespace-nowrap"
              >
                <DirectionIcon className="text-lg shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{t('viewDetails')}</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
