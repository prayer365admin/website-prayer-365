'use client'

import { useSiteI18n } from '@/i18n/site-i18n'
import { MobilePublicEvent } from '@/models/mobile'
import { ArrowRightOutlined } from '@ant-design/icons'
import { EVENT_CATEGORY_LABELS, homeCardThinShadowClassName } from './data'

const icsText = (value: string) => value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
const icsDate = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** Calendar file for one event. ponytail: events have no end time, so a 1-hour slot is assumed. */
export const eventIcs = (event: MobilePublicEvent) => {
  const start = new Date(event.startsAt)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prayer 365//Home//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@prayer365`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(new Date(start.getTime() + 60 * 60 * 1000))}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(event.location)}`,
    `DESCRIPTION:${icsText(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/**
 * Builds the .ics on click. Rendering it into an href would differ between server and browser
 * (DTSTAMP is "now") and break hydration.
 */
const saveEvent = (event: MobilePublicEvent) => {
  const url = URL.createObjectURL(new Blob([eventIcs(event)], { type: 'text/calendar' }))
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `${event.title}.ics`,
  })
  link.click()
  URL.revokeObjectURL(url)
}

const pill = 'inline-flex h-[22px] items-center rounded-full px-2.5 text-xs leading-none'

/** Home section 3, left 2 (`home-3-left-2.png`): next events of the main church. */
export default function UpcomingGatherings({
  events,
  timeZone,
}: {
  events: MobilePublicEvent[]
  timeZone?: string
}) {
  const { locale, t } = useSiteI18n()
  const part = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(iso))
  const languageName = (code: string) =>
    new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code.toUpperCase()

  return (
    <section aria-labelledby="home-gatherings-title" className={homeCardThinShadowClassName}>
      <div className="flex min-h-[90px] flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2
            className="text-xl font-semibold tracking-[-0.02em] text-primary-900 sm:text-2xl"
            id="home-gatherings-title"
          >
            {t('homeGatheringsTitle')}
          </h2>
          <p className="mt-1 text-sm text-neutral-600 sm:text-base">{t('homeGatheringsBody')}</p>
        </div>
        <span
          className="inline-flex items-center gap-2 text-xs font-medium text-primary-500"
          title={t('homeComingSoon')}
        >
          {t('homeGatheringsViewAll')} <ArrowRightOutlined />
        </span>
      </div>

      {events.length === 0 ? (
        <p className="border-t border-neutral-200 p-5 text-sm text-neutral-600">
          {t('homeGatheringsEmpty')}
        </p>
      ) : (
        <ul>
          {events.map((event) => (
            <li
              className="flex flex-col gap-3 border-t border-neutral-200 p-4 sm:min-h-[114px] sm:flex-row sm:items-end"
              key={event.id}
            >
              <div className="flex min-w-0 flex-1 gap-4">
                <time
                  className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-neutral-200 text-blue-800"
                  dateTime={event.startsAt}
                >
                  <span className="text-xs uppercase">
                    {part(event.startsAt, { month: 'short' })}
                  </span>
                  <span className="text-xl font-semibold leading-none">
                    {part(event.startsAt, { day: '2-digit' })}
                  </span>
                </time>
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    {event.languageCode && (
                      <span className={`${pill} bg-blue-50 text-primary-900`}>
                        {languageName(event.languageCode)}
                      </span>
                    )}
                    <span className={`${pill} bg-primary-300/30 text-primary-500`}>
                      {t(EVENT_CATEGORY_LABELS[event.category] ?? 'homeEventOther')}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-primary-900">{event.title}</h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-neutral-600">
                    {event.location}
                    {event.description && (
                      <>
                        <span className="mx-1.5 text-neutral-400">•</span>
                        {event.description}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <button
                  className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-blue-50 px-3.5 text-xs font-semibold text-primary-900 transition hover:bg-primary-300/30 sm:flex-none"
                  onClick={() => saveEvent(event)}
                  type="button"
                >
                  {t('homeGatheringsSaveDate')}
                </button>
                {event.registrationUrl && (
                  <a
                    className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-primary-500 px-3.5 text-xs font-semibold text-white transition hover:bg-primary-700 sm:flex-none"
                    href={event.registrationUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t('homeGatheringsRsvp')}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
