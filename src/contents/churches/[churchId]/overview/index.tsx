'use client'

import LayoutIcon from '@/components/common/layout-icon'
import PastorImage from '@/components/common/pastor-image'
import { formatMinorToMajor } from '@/contents/churches/donations/columns'
import {
  requestClassificationLabel,
  requestDetailHref,
  requestKindLabel,
} from '@/contents/churches/requests/columns'
import { useChurchOverview, useChurchProfile, useChurchServiceTimes } from '@/hooks/data/church'
import { useDonationSummary } from '@/hooks/data/donation'
import { useEvents } from '@/hooks/data/event'
import { useMediaAccess } from '@/hooks/data/media-access'
import { useChurchPastors } from '@/hooks/data/pastor'
import { usePrayers } from '@/hooks/data/prayer'
import { useAnnouncements } from '@/hooks/data/announcement'
import { formatEventStart } from '@/utils/event-datetime'
import { stripAudioTags } from '@/utils/strip-audio-tags'
import { BookOutlined, HeartFilled, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo } from 'react'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/* Figma dummy: fallback service times when none in backend */
const DUMMY_SERVICES = [
  { weekday: 6, localTime: '08:00', label: 'Morning Prayer' },
  { weekday: 6, localTime: '18:00', label: 'Evening Organ Vespers' },
]

/* Figma dummy: scripture ref not in backend */
const DUMMY_SCRIPTURE_REF = 'NUMBERS 6:24-26'

/* Figma dummy: fallback prayer body when none in backend */
const DUMMY_PRAYER_BODY =
  'The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace.'

export default function ContentsChurchOverview() {
  const { churchId } = useParams<{ churchId: string }>()
  const router = useRouter()

  const { data: overviewData } = useChurchOverview(churchId)
  const { data: profile } = useChurchProfile(churchId)
  const { data: heroMedia } = useMediaAccess(churchId, profile?.heroAssetId)
  const currentMonth = useMemo(() => dayjs().format('YYYY-MM'), [])
  const { data: donationSummary, loading: donationLoading } = useDonationSummary({
    churchId,
    month: currentMonth,
  })
  const { data: pastors } = useChurchPastors(churchId)
  const { data: prayers } = usePrayers({
    churchId,
    limit: 1,
    page: 1,
    orderBy: 'created_at',
    orderDirection: 'desc',
  })
  const { data: serviceTimes } = useChurchServiceTimes(churchId)
  const currentInstant = useMemo(() => dayjs().toISOString(), [])
  const { data: events } = useEvents({
    churchId,
    limit: 3,
    page: 1,
    orderBy: 'starts_at',
    orderDirection: 'asc',
    starts_from: currentInstant,
  })
  const { data: announcements } = useAnnouncements({
    churchId,
    limit: 3,
    page: 1,
    orderBy: 'published_at',
    orderDirection: 'desc',
  })

  const churchName = overviewData?.church?.name ?? 'Church'
  const churchTimezone = overviewData?.church?.timezone ?? 'UTC'
  const aggregates = overviewData?.aggregates
  const requests = overviewData?.requests

  const heroImageUrl = heroMedia?.url || '/images/viimsi-church-indoor.jpeg'

  const firstPastor = pastors?.[0]
  const latestPrayer = prayers?.[0]
  const prayerRawBody = latestPrayer?.current?.body
  const parsedPrayerBody = prayerRawBody
    ? stripAudioTags(prayerRawBody.replace(/<[^>]*>/g, ''))
    : DUMMY_PRAYER_BODY

  const sortedServices = useMemo(() => {
    if (serviceTimes && serviceTimes.length > 0) {
      return [...serviceTimes]
        .sort((a, b) => a.weekday - b.weekday || a.localTime.localeCompare(b.localTime))
        .slice(0, 3)
    }
    return DUMMY_SERVICES
  }, [serviceTimes])

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Hero banner */}
      <div className="relative h-[320px] w-full overflow-hidden rounded-2xl bg-neutral-900 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImageUrl}
          alt={churchName}
          className="absolute inset-0 h-full w-full rounded-2xl object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-b from-transparent to-black/75 px-4 pb-4 pt-10">
          <h1 className="m-0 text-2xl font-semibold leading-[100%] tracking-[-1px] text-white">
            {churchName}
          </h1>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/churches/${churchId}/profile`)}
            className="flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-[#0E203E] hover:bg-neutral-100"
          >
            <span>Manage</span>
            <RightOutlined aria-hidden="true" className="text-[14px] text-[#0E203E]" />
          </button>
        </div>
      </div>

      {/* 2. KPI row */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Followers */}
        <div className="relative flex flex-1 flex-col rounded-2xl bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <span className="pb-2 text-xs font-semibold text-[#5C6370]">Followers</span>
          <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
            {(aggregates?.memberCount ?? 0).toLocaleString()}
          </span>
          <div className="absolute right-4 top-4 text-[#2F7AD2]">
            <LayoutIcon name="users" />
          </div>
        </div>

        {/* Prayer reads */}
        <div className="relative flex flex-1 flex-col rounded-2xl bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <span className="pb-2 text-xs font-semibold text-[#5C6370]">Prayer reads</span>
          <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
            {(aggregates?.prayerCount ?? 0).toLocaleString()}
          </span>
          <div className="absolute right-4 top-4 text-[#F0B80F]">
            <BookOutlined className="text-[20px]" />
          </div>
        </div>

        {/* Confirmed donations */}
        <div className="relative flex flex-1 flex-col rounded-2xl bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <span className="pb-2 text-xs font-semibold text-[#5C6370]">Confirmed donations</span>
          <div className="flex flex-col gap-1">
            {donationLoading ? (
              <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
                —
              </span>
            ) : donationSummary?.currencies && donationSummary.currencies.length > 0 ? (
              donationSummary.currencies.map((c) => (
                <span
                  key={c.currency}
                  className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]"
                >
                  {formatMinorToMajor(c.netMinor, c.currency)}
                </span>
              ))
            ) : (
              <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
                0.00
              </span>
            )}
          </div>
          <div className="absolute right-4 top-4 text-[#B31A1A]">
            <HeartFilled className="text-[20px]" />
          </div>
        </div>
      </div>

      {/* 3. Row: Today's Prayer | Next Service */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Today's Prayer card */}
        <div className="flex flex-1 flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between border-b border-[#DDE0E4] p-4">
            <span className="text-base font-semibold text-[#0E203E]">Today&apos;s Prayer</span>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/churches/${churchId}/prayers`)}
              className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2F7AD2] hover:underline"
            >
              <span>Open</span>
              <RightOutlined aria-hidden="true" className="text-[12px]" />
            </button>
          </div>
          <div className="flex flex-col p-4">
            <div className="flex flex-col gap-3 rounded-lg border border-[#DDE0E4] p-4">
              {/* Author row */}
              <div className="flex items-center gap-3">
                <PastorImage
                  size={64}
                  imageAssetId={firstPastor?.imageAssetId ?? null}
                  churchId={churchId}
                  name={firstPastor?.name ?? 'Pastor —'}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#0E203E]">
                    {firstPastor?.name ?? 'Pastor —'}
                  </span>
                  {/* Figma dummy: voice-model field not on pastor summary */}
                  <span className="text-xs text-[#5C6370]">Model: —</span>
                </div>
              </div>

              {/* Quote panel */}
              <div className="flex flex-col gap-2 rounded-lg bg-[#F5F7FF] px-3 py-6">
                {/* Figma dummy: scripture ref not in backend */}
                <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[#2F7AD2]">
                  {DUMMY_SCRIPTURE_REF}
                </span>
                <p className="m-0 text-sm leading-normal text-[#131B2E]">{parsedPrayerBody}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Next Service card */}
        <div className="flex flex-1 flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between border-b border-[#DDE0E4] p-4">
            <span className="text-base font-semibold text-[#0E203E]">Next Service</span>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/churches/${churchId}/profile`)}
              className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2F7AD2] hover:underline"
            >
              <span>View all</span>
              <RightOutlined aria-hidden="true" className="text-[12px]" />
            </button>
          </div>
          <div className="flex flex-col p-4">
            {sortedServices.map((service, index) => (
              <div
                key={`${service.weekday}-${service.localTime}-${index}`}
                className="flex items-center justify-between border-b border-[#DDE0E4] px-2 py-4 last:border-b-0"
              >
                <span className="text-xs text-[#5C6370]">
                  {WEEKDAYS[service.weekday - 1] ?? 'Service'}
                </span>
                <span className="text-xs text-[#5C6370]">{service.localTime.slice(0, 5)}</span>
                <span className="text-right text-xs text-[#5C6370]">
                  {service.label ?? 'Service'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Row: Upcoming events | Announcements */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Upcoming events card */}
        <div className="flex flex-1 flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between border-b border-[#DDE0E4] p-4">
            <span className="text-base font-semibold text-[#0E203E]">Upcoming events</span>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/churches/${churchId}/events`)}
              className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2F7AD2] hover:underline"
            >
              <span>View all</span>
              <RightOutlined aria-hidden="true" className="text-[12px]" />
            </button>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto p-4">
            {!events?.length ? (
              <span className="text-xs text-[#5C6370]">No upcoming events planned.</span>
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex flex-col gap-1 rounded-xl bg-[#FAFAFB] p-4">
                  <span className="text-base font-semibold text-[#0E203E]">{event.title}</span>
                  <span className="text-xs text-[#5C6370]">
                    {formatEventStart(event.startsAt, churchTimezone)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Announcements card */}
        <div className="flex flex-1 flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between border-b border-[#DDE0E4] p-4">
            <span className="text-base font-semibold text-[#0E203E]">Announcements</span>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/churches/${churchId}/announcements`)}
              className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2F7AD2] hover:underline"
            >
              <span>View all</span>
              <RightOutlined aria-hidden="true" className="text-[12px]" />
            </button>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto p-4">
            {!announcements?.length ? (
              <span className="text-xs text-[#5C6370]">0 announcements</span>
            ) : (
              announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="flex flex-col gap-1 rounded-xl bg-[#FAFAFB] p-4"
                >
                  {/* Figma dummy: announcement category not in backend */}
                  <span className="text-xs font-semibold text-[#005CAD]">Church notice</span>
                  <span className="text-sm font-semibold text-[#191C1E]">{announcement.title}</span>
                  <span className="line-clamp-1 text-xs text-[#5C6370]">
                    {stripAudioTags(announcement.body.replace(/<[^>]*>/g, ''))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Row: Recent requests | Donations */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Recent requests card (only if requests is in overview payload) */}
        {requests && (
          <div className="flex flex-1 flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between border-b border-[#DDE0E4] p-4">
              <span className="text-base font-semibold text-[#0E203E]">Recent requests</span>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/churches/${churchId}/requests`)}
                className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2F7AD2] hover:underline"
              >
                <span>View all</span>
                <RightOutlined aria-hidden="true" className="text-[12px]" />
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto p-4">
              {requests.total === 0 ? (
                <span className="text-xs text-[#5C6370]">0 Request</span>
              ) : (
                requests.recent?.map((r) => (
                  <Link
                    key={r.id}
                    href={requestDetailHref(churchId, r.id)}
                    className="flex items-center justify-between rounded-lg border border-[#DDE0E4] p-3.5 transition-colors hover:bg-[#F5F7FF]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[#0E203E]">
                        {requestKindLabel(r.kind)}
                      </span>
                      <span className="text-xs text-[#5C6370]">
                        {requestClassificationLabel(r)}
                      </span>
                    </div>
                    <RightOutlined aria-hidden="true" className="text-[12px] text-[#8F96A3]" />
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {/* Donations card */}
        <div className="flex flex-1 flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between border-b border-[#DDE0E4] p-4">
            <span className="text-base font-semibold text-[#0E203E]">Donations</span>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <p className="m-0 text-xs text-[#5C6370]">
              Review transactions, recurring donations, and monthly totals.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/churches/${churchId}/donations`)}
              className="h-10 w-fit cursor-pointer rounded-lg border border-[#2F7AD2] bg-white px-3 text-sm font-semibold text-[#2F7AD2] hover:bg-[#F5F7FF]"
            >
              Open donations
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
