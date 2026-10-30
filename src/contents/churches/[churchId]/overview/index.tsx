'use client'

import PastorImage from '@/components/common/pastor-image'
import { ArrowRightTailIcon } from '@/components/icon/arrow-right-tail'
import { HandHoldingHeartIcon } from '@/components/icon/hand-holding-heart'
import { HandsPrayingIcon } from '@/components/icon/hands-praying'
import { PenIcon } from '@/components/icon/pen'
import { UsersIcon } from '@/components/icon/users'
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
import dayjs from 'dayjs'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo } from 'react'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

  const heroImageUrl = heroMedia?.url

  const firstPastor = pastors?.[0]
  const latestPrayer = prayers?.[0]
  const prayerRawBody = latestPrayer?.current?.body
  const parsedPrayerBody = prayerRawBody
    ? stripAudioTags(prayerRawBody.replace(/<[^>]*>/g, ''))
    : null

  const sortedServices = useMemo(() => {
    if (serviceTimes && serviceTimes.length > 0) {
      return [...serviceTimes]
        .sort((a, b) => a.weekday - b.weekday || a.localTime.localeCompare(b.localTime))
        .slice(0, 3)
    }
    return []
  }, [serviceTimes])

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Hero banner */}
      <div className="relative h-[320px] w-full overflow-hidden rounded-2xl bg-neutral-900 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
        {heroImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={heroImageUrl}
            alt={churchName}
            className="absolute inset-0 h-full w-full rounded-2xl object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-xs text-white/40">
            No cover image uploaded
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 bg-gradient-to-b from-transparent to-black/75 px-4 pb-4 pt-10 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <h1 className="m-0 text-2xl font-semibold leading-[100%] tracking-[-1px] text-white">
            {churchName}
          </h1>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/churches/${churchId}/profile`)}
            className="flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-semibold text-[#0E203E] hover:bg-neutral-100"
          >
            <PenIcon aria-hidden="true" className="text-[14px] text-[#0E203E]" />
            <span>Edit profile</span>
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
            <UsersIcon className="text-[18px]" />
          </div>
        </div>

        {/* Prayer reads */}
        <div className="relative flex flex-1 flex-col rounded-2xl bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
          <span className="pb-2 text-xs font-semibold text-[#5C6370]">Prayer reads</span>
          <span className="text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
            {(aggregates?.prayerCount ?? 0).toLocaleString()}
          </span>
          <div className="absolute right-4 top-4 text-[#F0B80F]">
            <HandsPrayingIcon className="text-[18px]" />
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
            <HandHoldingHeartIcon className="text-[18px]" />
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
              <span>Open prayer</span>
              <ArrowRightTailIcon aria-hidden="true" className="text-[12px]" />
            </button>
          </div>
          <div className="flex flex-col p-4">
            {latestPrayer && parsedPrayerBody ? (
              <div className="relative">
                {/* Author row */}
                {firstPastor ? (
                  <div className="relative z-10 flex items-center gap-3 pl-2">
                    <PastorImage
                      size={64}
                      imageAssetId={firstPastor?.imageAssetId ?? null}
                      churchId={churchId}
                      name={firstPastor?.name ?? 'Pastor Daniel Carter'}
                    />
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-[#0E203E]">
                        {firstPastor.name}
                      </span>
                      {firstPastor.pastoralRole ? (
                        <span className="text-xs text-[#5C6370]">{firstPastor.pastoralRole}</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* Quote card below - slightly clipped into by pastor avatar above */}
                <div
                  className={`${firstPastor ? '-mt-6 pt-8' : 'pt-4'} rounded-2xl bg-[#F8FAFF] p-4`}
                >
                  <p className="m-0 text-sm leading-normal text-[#131B2E]">
                    &ldquo;{parsedPrayerBody.replace(/^[“"]|[”"]$/g, '')}&rdquo;
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#5C6370]">
                No prayers published yet.
              </div>
            )}
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
              <span>View schedule</span>
              <ArrowRightTailIcon aria-hidden="true" className="text-[12px]" />
            </button>
          </div>
          <div className="flex flex-col p-4">
            {!sortedServices.length ? (
              <div className="py-8 text-center text-xs text-[#5C6370]">
                No service times scheduled.
              </div>
            ) : (
              sortedServices.map((service, index) => (
                <div
                  key={`${service.weekday}-${service.localTime}-${index}`}
                  className="flex items-center border-b border-[#DDE0E4] px-2 py-4 last:border-b-0"
                >
                  <span className="w-28 shrink-0 text-xs text-[#5C6370]">
                    {WEEKDAYS[service.weekday - 1] ?? 'Service'}
                  </span>
                  <span className="w-20 shrink-0 text-xs text-[#5C6370]">
                    {service.localTime.slice(0, 5)}
                  </span>
                  <span className="flex-1 truncate text-right text-xs text-[#5C6370]">
                    {service.label ?? 'Service'}
                  </span>
                </div>
              ))
            )}
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
              <span>View events</span>
              <ArrowRightTailIcon aria-hidden="true" className="text-[12px]" />
            </button>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto p-4">
            {!events?.length ? (
              <div className="py-8 text-center text-xs text-[#5C6370]">
                No upcoming events planned.
              </div>
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
              <span>View schedule</span>
              <ArrowRightTailIcon aria-hidden="true" className="text-[12px]" />
            </button>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto p-4">
            {!announcements?.length ? (
              <div className="py-8 text-center text-xs text-[#5C6370]">
                No announcements published yet.
              </div>
            ) : (
              announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="flex flex-col gap-1 rounded-xl bg-[#FAFAFB] p-4"
                >
                  <span className="text-sm font-semibold text-[#191C1E]">{announcement.title}</span>
                  <span className="line-clamp-2 text-xs text-[#5C6370]">
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
                <span>View events</span>
                <ArrowRightTailIcon aria-hidden="true" className="text-[12px]" />
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto p-4">
              {requests.total === 0 || !requests.recent?.length ? (
                <div className="py-8 text-center text-xs text-[#5C6370]">No recent requests.</div>
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
                    <ArrowRightTailIcon aria-hidden="true" className="text-[12px] text-[#8F96A3]" />
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
              className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#2F7AD2] bg-white px-3 text-sm font-semibold text-[#2F7AD2] hover:bg-[#F5F7FF]"
            >
              <HandHoldingHeartIcon aria-hidden="true" className="text-base text-[#2F7AD2]" />
              <span>View Donations</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
