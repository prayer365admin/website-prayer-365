'use client'

import MaskIcon from '@/components/site/mask-icon'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobilePublicChurch } from '@/models/mobile'
import { CompassOutlined } from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'
import { homeCardClassName, homeCardThinShadowClassName } from './data'

const directionsUrl = (church: MobilePublicChurch) => {
  const destination = church.coordinates
    ? `${church.coordinates.latitude},${church.coordinates.longitude}`
    : [
        church.address.line1,
        church.address.city,
        church.address.postalCode,
        church.address.countryCode,
      ]
        .filter(Boolean)
        .join(', ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

// 2024-01-01 is a Monday, so weekday 1–7 (Mon–Sun) maps onto Jan 1–7.
const weekdayName = (weekday: number, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, weekday)),
  )

const SERVICE_ICONS = ['/icons/icon-bell-ring-outlined.svg', '/icons/icon-book-bible.svg']

/** Home section 3, left 1 (`home-3-left-1.png`): the customer's main church. */
export default function PrimaryParish({ church }: { church: MobilePublicChurch | null }) {
  const { locale, t } = useSiteI18n()

  if (!church) {
    return (
      <section className={`p-5 sm:p-6 ${homeCardClassName}`}>
        <h2 className="text-lg font-semibold text-primary-900">{t('homeParishEmptyTitle')}</h2>
        <p className="mt-1 text-sm text-neutral-600">{t('homeParishEmptyBody')}</p>
        <Link
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary-500 px-4 text-sm font-semibold text-white"
          href="/customer"
        >
          {t('homeParishEmptyAction')}
        </Link>
      </section>
    )
  }

  const services = church.serviceTimes.slice(0, 2)

  return (
    <section
      aria-labelledby="home-parish-name"
      className={`p-4 sm:p-5 ${homeCardThinShadowClassName}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            aria-label={church.name}
            className="relative size-[72px] shrink-0 overflow-hidden rounded-2xl bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 sm:size-[90px]"
            href={`/churches/${church.id}`}
          >
            {church.coverUrl ? (
              <Image alt="" className="object-cover" fill sizes="90px" src={church.coverUrl} />
            ) : (
              <span className="flex size-full items-center justify-center">
                <MaskIcon className="bg-primary-300" size={32} src="/icons/icon-church-2.svg" />
              </span>
            )}
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-blue-800">
              <span className="uppercase">{t('homeParishLabel')}</span>
              <span className="mx-1.5 text-neutral-400">•</span>
              {[church.address.line1, church.address.city].filter(Boolean).join(', ')}
            </p>
            <h2
              className="mt-1 text-lg font-semibold text-primary-900 sm:text-xl"
              id="home-parish-name"
            >
              <Link className="transition hover:text-primary-500" href={`/churches/${church.id}`}>
                {church.name}
              </Link>
            </h2>
            {church.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-600">
                {church.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <a
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 text-sm font-semibold text-blue-800 transition hover:bg-primary-300/30 sm:flex-none"
            href={directionsUrl(church)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <CompassOutlined /> {t('homeParishDirections')}
          </a>
        </div>
      </div>

      {services.length > 0 && (
        <ul className="mt-4 grid gap-3 rounded-xl bg-blue-50 p-2 sm:grid-cols-2">
          {services.map((service, index) => (
            <li className="flex items-center gap-3" key={`${service.weekday}-${service.localTime}`}>
              <span className="flex size-[43px] shrink-0 items-center justify-center rounded-lg bg-primary-150">
                <MaskIcon className="bg-primary-500" size={18} src={SERVICE_ICONS[index]} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-neutral-600">
                  {service.label || t('homeServiceFallback')}
                </p>
                <p className="text-sm font-semibold text-primary-900">
                  {t('homeServiceEvery', {
                    weekday: weekdayName(service.weekday, locale),
                    time: service.localTime,
                  })}
                  {service.languageCode && ` (${service.languageCode.toUpperCase()})`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
