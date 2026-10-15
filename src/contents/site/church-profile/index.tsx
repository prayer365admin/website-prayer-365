'use client'

import { useEffect, useRef, useState } from 'react'
import { ChurchIcon } from '@/components/icon/church'
import { SparklesIcon } from '@/components/icon/sparkles'
import { WaveformIcon } from '@/components/icon/waveform'
import { UsersGroupIcon } from '@/components/icon/users-group'
import { UtensilsIcon } from '@/components/icon/utensils'
import {
  useSiteChurchAnnouncements,
  useSiteChurchEvents,
  useSiteChurchPrayers,
  useSiteChurchProfile,
} from '@/hooks/data/site/churches'
import { useSiteHome } from '@/hooks/data/site/home'
import { useSiteI18n } from '@/i18n/site-i18n'
import type { MobilePublishedPrayer } from '@/models/mobile'
import {
  ArrowRightOutlined,
  CaretRightFilled,
  EnvironmentOutlined,
  MailOutlined,
  PauseOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { Alert, Button, Modal, Skeleton, Typography } from 'antd'
import axios from 'axios'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import Image from 'next/image'
import Link from 'next/link'
import { Hero } from './hero'
import { GoogleMapPins } from '@/components/common/google-map'
import { IntercessionHub } from './intercession-hub'
import { SectionCard } from './section-card'
import { Stewardship } from './stewardship'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
dayjs.extend(utc)
dayjs.extend(timezone)

interface PrayerAudioRowProps {
  prayer: MobilePublishedPrayer
  isActive: boolean
  onTogglePlay: () => void
  pastorFallback: string
  churchName: string
  onOpenTranscript: (title: string, body: string) => void
  isSaved: boolean
  onToggleSave: () => void
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2.5 10.5V12.5C2.5 13.0523 2.94772 13.5 3.5 13.5H12.5C13.0523 13.5 13.5 13.0523 13.5 12.5V10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 2.5V10.5M8 10.5L4.75 7.25M8 10.5L11.25 7.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TranscriptIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 3.75H9M3 7.25H13M3 10.75H8.5M3 14.25H13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BookmarkPlusIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.75 2.5C3.75 1.94772 4.19772 1.5 4.75 1.5H11.25C11.8023 1.5 12.25 1.94772 12.25 2.5V14.5L8 11.75L3.75 14.5V2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
      <path
        d="M8 4.75V8.25M6.25 6.5H9.75"
        stroke={filled ? '#FFFFFF' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PrayerAudioRow({
  prayer,
  isActive,
  onTogglePlay,
  pastorFallback,
  churchName,
  onOpenTranscript,
  isSaved,
  onToggleSave,
}: PrayerAudioRowProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(60)

  const audioSrc = prayer.audio?.assetKey || '/audio/peace-in-uncertain-times.mp3'

  useEffect(() => {
    if (!audioRef.current) return
    if (isActive) {
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
    }
  }, [isActive])

  const formatAudioTime = (sec: number) => {
    if (!Number.isFinite(sec) || isNaN(sec)) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    const nextTime = percent * duration
    audioRef.current.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  return (
    <div className="p-5 transition-colors hover:bg-[#FAFAFB]">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime)
          }
        }}
        onLoadedMetadata={() => {
          if (
            audioRef.current &&
            Number.isFinite(audioRef.current.duration) &&
            audioRef.current.duration > 0
          ) {
            setDuration(audioRef.current.duration)
          }
        }}
        onDurationChange={() => {
          if (
            audioRef.current &&
            Number.isFinite(audioRef.current.duration) &&
            audioRef.current.duration > 0
          ) {
            setDuration(audioRef.current.duration)
          }
        }}
        onEnded={() => {
          if (isActive) {
            onTogglePlay()
          }
          setCurrentTime(0)
        }}
      />
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#2F7AD2] uppercase">
        <WaveformIcon className="text-sm text-[#2F7AD2]" />
        <span>GUIDED CONTEMPLATION</span>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isActive ? 'Pause' : 'Play'}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2F7AD2] text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
          >
            {isActive ? (
              <PauseOutlined className="text-lg" />
            ) : (
              <CaretRightFilled className="text-xl ml-0.5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[#0E203E]">{prayer.version.title}</h3>
            {isActive ? (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs font-medium text-[#5C6370]">
                  {formatAudioTime(currentTime)}
                </span>
                <div
                  onClick={handleSeek}
                  role="slider"
                  tabIndex={0}
                  aria-label="Audio progress"
                  aria-valuenow={currentTime}
                  aria-valuemin={0}
                  aria-valuemax={duration}
                  className="relative h-2 flex-1 cursor-pointer overflow-hidden rounded-full bg-[#DDE0E4] hover:h-2.5 transition-all"
                >
                  <div
                    className="h-full rounded-full bg-[#2F7AD2]"
                    style={{
                      width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-[#5C6370]">
                  {formatAudioTime(duration)}
                </span>
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-[#5C6370]">
                {prayer.version.introduction ||
                  `Led by ${pastorFallback || 'Pastor'}, ${churchName}`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
          <a
            href={audioSrc}
            download={`${prayer.version.title}.mp3`}
            target="_blank"
            rel="noopener noreferrer"
            title="Download Audio"
            aria-label="Download Audio"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE0E4] bg-white text-[#2F7AD2] transition-colors hover:bg-[#F4F7FC] hover:border-[#2F7AD2]"
          >
            <DownloadIcon />
          </a>
          <button
            type="button"
            title="View Transcript"
            aria-label="View Transcript"
            onClick={() => onOpenTranscript(prayer.version.title, prayer.version.body)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE0E4] bg-white text-[#2F7AD2] transition-colors hover:bg-[#F4F7FC] hover:border-[#2F7AD2]"
          >
            <TranscriptIcon />
          </button>
          <button
            type="button"
            title={isSaved ? 'Saved' : 'Save'}
            aria-label={isSaved ? 'Saved' : 'Save'}
            onClick={onToggleSave}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              isSaved
                ? 'border-[#2F7AD2] bg-[#E6EDFB] text-[#2F7AD2]'
                : 'border-[#DDE0E4] bg-white text-[#2F7AD2] hover:bg-[#F4F7FC] hover:border-[#2F7AD2]'
            }`}
          >
            <BookmarkPlusIcon filled={isSaved} />
          </button>
        </div>
      </div>
    </div>
  )
}
function getStaffInitials(name: string): string {
  const clean = name.replace(/^(Rev\.|Chaplain|Dr\.|Pastor|Bishop|Deacon)\s+/i, '').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function FacilityIcon({ index }: { index: number }) {
  const className = 'text-[#2F7AD2] shrink-0'
  switch (index) {
    case 0:
      return (
        <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="4" r="2" />
          <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.4-.44-.98-.7-1.6-.72-.61-.02-1.2.2-1.64.61L7.29 10.74C6.48 11.51 6 12.58 6 13.7v4.8c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-4.3l1.8-1.7V17c0 1.66 1.34 3 3 3h4c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-4c-.55 0-1-.45-1-1v-4.8c.84.5 1.83.8 2.91.8h3.29zM10.5 19.5c0 1.93-1.57 3.5-3.5 3.5S3.5 21.43 3.5 19.5 5.07 16 7 16c.35 0 .69.05 1 .15V14.1C7.36 14.04 7.03 14 6.7 14c-3.15 0-5.7 2.55-5.7 5.7S3.55 25.4 6.7 25.4s5.7-2.55 5.7-5.7c0-.1 0-.2-.01-.3h-1.89z" />
        </svg>
      )
    case 1:
      return (
        <svg
          className={className}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10" />
          <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 0 4 0" />
          <line x1="8.5" y1="18.5" x2="8.5" y2="18.51" />
        </svg>
      )
    case 2:
      return (
        <svg
          className={className}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    case 3:
      return (
        <svg
          className={className}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )
    case 4:
    default:
      return (
        <svg
          className={className}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      )
  }
}
function parseSanctuaryHours(
  hours: string,
): Array<{ title: string; time: string; description: string }> {
  const trimmed = hours.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: Record<string, unknown>) => ({
          title: String(item.title || ''),
          time: String(item.time || ''),
          description: String(item.description || ''),
        }))
      }
    } catch {
      // Fall through to string parsing
    }
  }

  if (trimmed.includes(' • ')) {
    return trimmed.split(' • ').map((part) => {
      const p = part.trim()
      const match = p.match(/^([A-Za-z\u2013\u2014\-’'\s]+)\s+([\d:–\- ]+)$/)
      if (match) {
        let title = match[1].trim()
        if (title === 'Mon–Fri' || title === 'Mon-Fri') title = 'Monday - Friday'
        else if (title === 'Sat') title = 'Saturday'
        else if (title === 'Sun') title = 'LORD’S Day (Sunday)'
        let description =
          'Altar steps & Nave open. Votive candles and prayer request scrolls provided.'
        if (title === 'Saturday') {
          description = 'Organ rehearsals in progress. Meditative listening encouraged.'
        } else if (title === 'LORD’S Day (Sunday)') {
          description = 'Continuous worship, Eucharist, fellowship coffee, and choral vespers.'
        }
        return { title, time: match[2].trim(), description }
      }
      return {
        title: p,
        time: '',
        description: 'Altar steps & Nave open for quiet prayer and devotion.',
      }
    })
  }

  return [
    {
      title: 'Daily Sanctuary Hours',
      time: trimmed,
      description: 'Altar steps & Nave open for quiet prayer, contemplation, and devotion.',
    },
  ]
}
function GalleryImage({
  src,
  fallbackSrc,
  alt,
}: {
  src: string
  fallbackSrc: string
  alt: string
}) {
  const [failed, setFailed] = useState(false)
  const currentSrc = !failed ? src : fallbackSrc

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      unoptimized
      className="object-cover transition-transform duration-300 group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  )
}

export default function ContentsSiteChurchProfile({ churchId }: { churchId: string }) {
  const { t } = useSiteI18n()
  const { data, loading, error, retry } = useSiteChurchProfile(churchId)
  const { data: events = [], loading: eventsLoading } = useSiteChurchEvents(churchId)
  const { data: announcements = [] } = useSiteChurchAnnouncements(churchId)
  const { data: prayers = [], loading: prayersLoading } = useSiteChurchPrayers(churchId)
  const { data: homeData } = useSiteHome()
  const isPrimaryParish = homeData?.mainChurch?.id === churchId
  const [prayerFilter, setPrayerFilter] = useState<'All' | 'Eucharist' | 'Contemplative'>('All')
  const [activePrayerId, setActivePrayerId] = useState<string | null>(null)
  const [savedPrayerIds, setSavedPrayerIds] = useState<Set<string>>(new Set())
  const [transcriptModal, setTranscriptModal] = useState<{ title: string; body: string } | null>(
    null,
  )

  const is404 = axios.isAxiosError(error) && error.response?.status === 404

  if (loading) {
    return (
      <div className="mx-auto max-w-[1152px] p-6">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="mx-auto max-w-[1152px] p-6">
        {is404 ? (
          <Typography.Text>{t('churchNotFound')}</Typography.Text>
        ) : (
          <Alert
            type="error"
            title={t('error')}
            action={<Button onClick={() => retry()}>Retry</Button>}
          />
        )}
      </div>
    )
  }

  if (!data) return null

  // Worship services list
  const worshipServices = data.serviceTimes || []

  // Filtered prayers
  const prayerList = Array.isArray(prayers) ? prayers : []
  const filteredPrayers = prayerList.filter((p) => {
    if (prayerFilter === 'All') return true
    const text =
      `${p?.version?.title ?? ''} ${p?.version?.introduction ?? ''} ${p?.version?.body ?? ''}`.toLowerCase()
    if (prayerFilter === 'Eucharist') {
      return text.includes('eucharist') || text.includes('communion')
    }
    if (prayerFilter === 'Contemplative') {
      return (
        text.includes('contemplat') ||
        text.includes('meditation') ||
        text.includes('peace') ||
        text.includes('shepherd') ||
        text.includes('vesper')
      )
    }
    return true
  })
  // Full address line
  const fullAddress = [
    data.address?.line1,
    data.address?.line2,
    [data.address?.postalCode, data.address?.city].filter(Boolean).join(' '),
    data.address?.countryCode,
  ]
    .filter(Boolean)
    .join(', ')

  const destinationQuery = data.coordinates
    ? `${data.coordinates.latitude},${data.coordinates.longitude}`
    : fullAddress

  const directionsHref = destinationQuery
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`
    : '#'
  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* 1. Hero banner */}
      <Hero church={data} isPrimaryParish={isPrimaryParish} />

      {/* 2. Main content grid */}
      <div className="mx-auto max-w-[1152px] px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_364px]">
          {/* Primary column */}
          <div className="space-y-8">
            {/* Pastoral Welcome / About Card */}
            <section className="flex flex-col justify-between rounded-2xl border border-[#DDE0E4] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:p-8">
              <div>
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#B9D8F8] px-3 py-1 text-xs font-semibold text-[#0B4497]">
                  <SparklesIcon className="text-sm text-[#2F7AD2]" />
                  <span>{data.pastorName ? t('pastorsWelcome') : t('aboutParish')}</span>
                </div>

                {data.description ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5C6370] sm:text-base">
                    {data.description}
                  </p>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-6 text-center text-sm text-[#5C6370]">
                    {t('noDescription')}
                  </div>
                )}
              </div>

              {(data.pastorName || data.denomination) && (
                <div className="mt-6 flex items-center gap-3.5 border-t border-[#DDE0E4] pt-4">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#16629B] font-bold text-white text-base">
                    <span>{(data.pastorName || data.name).charAt(0)}</span>
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0B4497] text-white">
                      <ChurchIcon className="text-[8px]" />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0E203E]">
                      {data.pastorName || data.name}
                    </div>
                    <div className="text-xs font-medium text-[#2F7AD2]">
                      {data.pastorName
                        ? [data.pastorRole, data.denomination].filter(Boolean).join(' • ')
                        : data.denomination}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Sanctuary Hours card */}
            <SectionCard
              title={t('sanctuaryHours')}
              subtitle={t('sacredSpaceQuietTime')}
              action={
                data.sanctuaryHours ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B9D8F8] px-3 py-1 text-xs font-semibold text-[#0B4497]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2F7AD2]" />
                    <span>Sanctuary Keepers on Duty</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-[#F0F2F5] px-3 py-1 text-xs font-medium text-[#5C6370]">
                    {t('hoursUnlisted')}
                  </span>
                )
              }
              bodyClassName="p-4 sm:p-6"
            >
              {data.sanctuaryHours ? (
                (() => {
                  const items = parseSanctuaryHours(data.sanctuaryHours)
                  const gridCols =
                    items.length === 1
                      ? 'grid-cols-1'
                      : items.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-3'
                  return (
                    <div className={`grid gap-4 ${gridCols}`}>
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col justify-between rounded-2xl border border-[#DDE0E4] bg-[#FAFAFB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <h4 className="text-base font-semibold text-[#0E203E]">
                                {item.title}
                              </h4>
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2F7AD2]" />
                            </div>
                            {item.time && (
                              <div className="mt-0.5 text-xs text-[#5C6370]">{item.time}</div>
                            )}
                          </div>
                          {item.description && (
                            <p className="mt-4 text-xs leading-relaxed text-[#5C6370]">
                              {item.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()
              ) : (
                <div className="rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-6 text-center text-sm text-[#5C6370]">
                  {t('noSanctuaryHours')}
                </div>
              )}
            </SectionCard>

            {/* Worship Services / Prayer Lists card */}
            <SectionCard
              title={t('worshipServices')}
              subtitle={prayers.length > 0 ? 'Prayer Lists' : t('serviceTimes')}
              action={
                prayers.length > 0 ? (
                  <div className="flex items-center gap-1 rounded-full bg-[#F0F2F5] p-1">
                    {(['All', 'Eucharist', 'Contemplative'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setPrayerFilter(tab)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          prayerFilter === tab
                            ? 'bg-[#2F7AD2] text-white shadow-sm'
                            : 'text-[#5C6370] hover:text-[#0E203E]'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                ) : null
              }
              bodyClassName="divide-y divide-[#DDE0E4] p-0"
            >
              {prayersLoading ? (
                <div className="p-6">
                  <Skeleton active paragraph={{ rows: 4 }} />
                </div>
              ) : prayers.length > 0 ? (
                filteredPrayers.length === 0 ? (
                  <div className="m-4 rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-6 text-center text-sm text-[#5C6370]">
                    No prayers found under {prayerFilter}.
                  </div>
                ) : (
                  filteredPrayers.map((prayer) => (
                    <PrayerAudioRow
                      key={prayer.id}
                      prayer={prayer}
                      isActive={activePrayerId === prayer.id}
                      onTogglePlay={() => {
                        setActivePrayerId((prev) => (prev === prayer.id ? null : prayer.id))
                      }}
                      pastorFallback={data.pastorName || ''}
                      churchName={data.name}
                      onOpenTranscript={(title, body) => setTranscriptModal({ title, body })}
                      isSaved={savedPrayerIds.has(prayer.id)}
                      onToggleSave={() => {
                        setSavedPrayerIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(prayer.id)) next.delete(prayer.id)
                          else next.add(prayer.id)
                          return next
                        })
                      }}
                    />
                  ))
                )
              ) : worshipServices.length === 0 ? (
                <div className="m-4 rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-6 text-center text-sm text-[#5C6370]">
                  {t('noWorshipServices')}
                </div>
              ) : (
                worshipServices.map((st, i) => {
                  const serviceTitle = st.label || WEEKDAYS[st.weekday - 1]
                  return (
                    <div
                      key={i}
                      className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E6EDFB] text-[#2F7AD2]">
                          <ChurchIcon className="text-xl" />
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold tracking-wider text-[#2F7AD2]">
                            {WEEKDAYS[st.weekday - 1].toUpperCase()}
                          </div>
                          <div className="text-base font-semibold text-[#0E203E]">
                            {serviceTitle}
                          </div>
                          <div className="text-xs text-[#5C6370]">
                            {st.localTime} • {data.timezone}
                          </div>
                        </div>
                      </div>

                      {st.languageCode && (
                        <div className="self-start sm:self-auto">
                          <span className="rounded-full bg-[#F0F2F5] px-2.5 py-1 text-xs font-semibold text-[#5C6370]">
                            {st.languageCode.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </SectionCard>

            {/* Upcoming Gatherings card */}
            <SectionCard
              title={t('upcomingGatherings')}
              subtitle={t('gatheringFellowship')}
              action={
                <Link
                  href={`/churches/${churchId}/prayers`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F7AD2] hover:underline"
                >
                  <span>{t('fullCalendar')}</span>
                  <ArrowRightOutlined />
                </Link>
              }
              bodyClassName="p-4 sm:p-6"
            >
              {events.length === 0 || eventsLoading ? (
                <div className="rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-6 text-center text-sm text-[#5C6370]">
                  {t('noUpcomingGatherings')}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {events.slice(0, 3).map((ev, idx) => {
                    const formattedDate = ev.startsAt
                      ? dayjs
                          .utc(ev.startsAt)
                          .tz(data.timezone || 'UTC')
                          .format('ddd, MMM D HH:mm')
                      : ''
                    const regUrl = ev.registrationUrl
                    const buttonLabel = ev.ctaLabel?.trim() || t('joinService')
                    return (
                      <div
                        key={ev.id || idx}
                        className="flex flex-col justify-between rounded-2xl border border-[#DDE0E4] bg-[#FAFAFB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-sm"
                      >
                        <div>
                          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[#0E203E] min-h-[44px]">
                            {ev.title}
                          </h3>
                          <div className="mt-1 text-xs font-medium text-[#5C6370]">
                            {[formattedDate, ev.location].filter(Boolean).join(' • ')}
                          </div>
                          <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[#5C6370] min-h-[44px]">
                            {ev.description || t('noDescription')}
                          </p>
                        </div>
                        <div className="mt-5">
                          {regUrl ? (
                            <a
                              href={regUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={
                                ev.ctaLabel?.trim()
                                  ? `${buttonLabel} - ${t('joinService')}`
                                  : t('joinService')
                              }
                              className="block w-full rounded-xl border border-[#2F7AD2] bg-white py-2 text-center text-xs font-semibold text-[#2F7AD2] transition-colors hover:bg-[#E6EDFB]"
                            >
                              {buttonLabel}
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="block w-full rounded-xl border border-[#DDE0E4] bg-[#F0F2F5] py-2 text-center text-xs font-semibold text-[#8C93A0] cursor-not-allowed"
                            >
                              {buttonLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>

            {/* Diaconal Ministry card */}
            <SectionCard
              title={t('diaconalMinistry')}
              subtitle={t('livingFaithInAction')}
              bodyClassName="p-4 sm:p-6"
            >
              {data.diaconalPrograms?.length ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {data.diaconalPrograms.map((prog, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col justify-between rounded-2xl border border-[#DDE0E4] bg-[#FAFAFB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <div>
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2F7AD2] text-white shadow-sm">
                          {prog.icon === 'users-group' ? (
                            <UsersGroupIcon className="text-xl" />
                          ) : (
                            <UtensilsIcon className="text-xl" />
                          )}
                        </div>
                        <h3 className="text-xl font-semibold leading-snug text-[#0E203E]">
                          {prog.title}
                        </h3>
                        <p className="mt-3 text-xs leading-relaxed text-[#5C6370]">
                          {prog.description}
                        </p>
                      </div>
                      <div className="mt-6 flex items-center justify-between border-t border-[#DDE0E4]/60 pt-4 text-xs">
                        <span className="font-medium text-[#2F7AD2]">{prog.badgeText}</span>
                        <span className="text-[#5C6370]">{prog.metaText}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-6 text-center text-sm text-[#5C6370]">
                  {t('noDiaconalPrograms')}
                </div>
              )}
            </SectionCard>
            {/* Sanctuary Gallery card */}
            <SectionCard
              title={t('sanctuaryGallery')}
              subtitle={t('sacredArtHeritage')}
              action={
                <div className="text-right text-xs leading-snug">
                  <div className="font-medium text-[#0B4497]">Constructed 1862–1867</div>
                  <div className="text-[#2F7AD2]">Architect Christoph August Gabler</div>
                </div>
              }
            >
              {(() => {
                const fallbackCover = data.coverUrl || '/images/church.jpeg'
                const tiles = data.gallery?.length
                  ? data.gallery
                  : data.coverUrl
                    ? [{ assetId: 'cover', url: data.coverUrl, caption: null, orderIndex: 0 }]
                    : []
                if (tiles.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-6 text-center text-sm text-[#5C6370]">
                      {t('noGalleryPhotos')}
                    </div>
                  )
                }

                if (tiles.length >= 5) {
                  return (
                    <div className="space-y-4">
                      {/* Row 1: 2 items */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.35fr_1fr]">
                        {tiles.slice(0, 2).map((tile, idx) => (
                          <div
                            key={`${tile.assetId ?? 'tile'}-${tile.orderIndex ?? idx}`}
                            className="group relative h-[220px] w-full overflow-hidden rounded-2xl border border-[#DDE0E4] bg-[#0E203E] sm:h-[260px]"
                          >
                            <GalleryImage
                              src={tile.url || fallbackCover}
                              fallbackSrc={fallbackCover}
                              alt={tile.caption || `${data.name} — Sanctuary`}
                            />
                            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                            <p className="absolute bottom-0 left-0 right-0 z-20 p-3.5 text-xs font-semibold text-white drop-shadow-md sm:p-4 sm:text-sm">
                              {tile.caption || `${data.name} — Sanctuary`}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Row 2: 3 items */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {tiles.slice(2, 5).map((tile, idx) => (
                          <div
                            key={`${tile.assetId ?? 'tile'}-${tile.orderIndex ?? idx + 2}`}
                            className="group relative h-[180px] w-full overflow-hidden rounded-2xl border border-[#DDE0E4] bg-[#0E203E] sm:h-[220px]"
                          >
                            <GalleryImage
                              src={tile.url || fallbackCover}
                              fallbackSrc={fallbackCover}
                              alt={tile.caption || `${data.name} — Sanctuary`}
                            />
                            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                            <p className="absolute bottom-0 left-0 right-0 z-20 p-3 text-xs font-semibold text-white drop-shadow-md sm:p-3.5">
                              {tile.caption || `${data.name} — Sanctuary`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {tiles.map((tile, idx) => (
                      <div
                        key={`${tile.assetId ?? 'tile'}-${tile.orderIndex ?? idx}`}
                        className="group relative h-[200px] w-full overflow-hidden rounded-2xl border border-[#DDE0E4] bg-[#0E203E] sm:h-[240px]"
                      >
                        <GalleryImage
                          src={tile.url || fallbackCover}
                          fallbackSrc={fallbackCover}
                          alt={tile.caption || `${data.name} — Sanctuary`}
                        />
                        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                        <p className="absolute bottom-0 left-0 right-0 z-20 p-3.5 text-xs font-semibold text-white drop-shadow-md sm:text-sm">
                          {tile.caption || `${data.name} — Sanctuary`}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </SectionCard>
          </div>

          {/* Aside column */}
          <div className="space-y-6">
            {/* Parish Intercession Hub */}
            <IntercessionHub churchId={churchId} churchName={data.name} />

            {/* Location card */}
            {data.coordinates && (
              <section className="rounded-2xl border border-[#DDE0E4] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <h2 className="text-xl font-semibold text-[#0E203E]">{t('location')}</h2>
                <GoogleMapPins
                  points={[
                    {
                      id: data.id,
                      latitude: data.coordinates.latitude,
                      longitude: data.coordinates.longitude,
                      label: data.name,
                    },
                  ]}
                  zoom={15}
                  className="mt-3 h-[220px] w-full"
                />
                {fullAddress && (
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#DDE0E4] bg-white px-4 py-2 text-sm font-semibold text-[#0E203E] hover:bg-[#F7F9FB]"
                  >
                    {t('directions')}
                  </a>
                )}
              </section>
            )}

            {/* Pastoral Care Office card */}
            <section className="rounded-2xl border border-[#DDE0E4] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#0E203E]">{t('pastoralCareOffice')}</h2>
                {data.deaneryName && (
                  <span className="rounded-full bg-[#B9D8F8] px-2.5 py-0.5 text-xs text-[#0B4497]">
                    {data.deaneryName}
                  </span>
                )}
              </div>

              {/* Staff directory */}
              {data.staff?.length ? (
                <div className="space-y-2">
                  {data.staff.map((person, idx) => {
                    const initials = getStaffInitials(person.name)
                    return (
                      <div
                        key={idx}
                        className="flex h-16 items-center justify-between rounded-lg bg-[#FAFAFB] p-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6EDFB] text-xl font-semibold text-[#2F7AD2]">
                            {person.imageUrl ? (
                              <Image
                                src={person.imageUrl}
                                alt={person.name}
                                width={48}
                                height={48}
                                className="h-full w-full rounded-xl object-cover"
                              />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-base font-semibold leading-snug text-[#0E203E]">
                              {person.name}
                            </div>
                            <div className="text-xs text-[#0B4497]">{person.pastoralRole}</div>
                          </div>
                        </div>
                        {data.contacts?.email && (
                          <a
                            href={`mailto:${data.contacts.email}`}
                            aria-label={`Email ${person.name}`}
                            className="mr-2 text-[#2F7AD2] transition-colors hover:text-[#0B4497]"
                          >
                            <MailOutlined className="text-sm" />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mb-4 rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-3 text-center text-xs text-[#5C6370]">
                  {t('noStaffDirectory')}
                </div>
              )}

              {/* Real contact links footer */}
              <div className="mt-4 space-y-2 border-t border-[#DDE0E4] pt-4 text-xs text-[#5C6370]">
                {data.contacts?.phone && (
                  <div className="flex items-center gap-2">
                    <PhoneOutlined className="text-xs text-[#2F7AD2]" />
                    <span>
                      Parish Secretary:{' '}
                      <a
                        href={`tel:${data.contacts.phone}`}
                        className="text-[#5C6370] hover:underline"
                      >
                        {data.contacts.phone}
                      </a>{' '}
                      (Mon–Thu 09–15)
                    </span>
                  </div>
                )}
                {data.contacts?.email && (
                  <div className="flex items-center gap-2">
                    <MailOutlined className="text-xs text-[#2F7AD2]" />
                    <span>
                      General:{' '}
                      <a
                        href={`mailto:${data.contacts.email}`}
                        className="text-[#5C6370] hover:underline"
                      >
                        {data.contacts.email}
                      </a>
                    </span>
                  </div>
                )}
                {fullAddress && (
                  <div className="flex items-start gap-2">
                    <EnvironmentOutlined className="mt-0.5 text-xs text-[#2F7AD2]" />
                    <span>{fullAddress}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Parish Stewardship widget */}
            <Stewardship churchName={data.name} denomination={data.denomination || undefined} />

            {/* Sanctuary Facilities & Access card */}
            <section className="rounded-2xl border border-[#DDE0E4] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <h2 className="mb-3 text-xl font-semibold text-[#0E203E]">{t('facilitiesAccess')}</h2>
              <div className="space-y-2">
                {(() => {
                  const facilityItems = data.accessibility
                    ? data.accessibility
                        .split(' • ')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : []
                  if (facilityItems.length === 0) {
                    return (
                      <div className="rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-4 text-center text-xs text-[#5C6370]">
                        {t('noAccessibilityInfo')}
                      </div>
                    )
                  }
                  return facilityItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 rounded-2xl bg-[#FAFAFB] px-4 py-2.5 text-xs text-[#5C6370]"
                    >
                      <FacilityIcon index={idx} />
                      <span>{item}</span>
                    </div>
                  ))
                })()}
              </div>
            </section>

            {/* Parish Notice Board card */}
            <section className="rounded-2xl border border-[#DDE0E4] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <h2 className="mb-3 text-xl font-semibold text-[#0E203E]">
                {t('parishNoticeBoard')}
              </h2>
              {announcements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-4 text-center text-xs text-[#5C6370]">
                  {t('noNoticeBoard')}
                </div>
              ) : (
                <div className="space-y-2">
                  {announcements.slice(0, 2).map((item, idx) => {
                    const colonIdx = item.body.indexOf(':')
                    const category =
                      colonIdx > 0 && colonIdx < 35 ? item.body.slice(0, colonIdx).trim() : null
                    const bodyText =
                      colonIdx > 0 && colonIdx < 35
                        ? item.body.slice(colonIdx + 1).trim()
                        : item.body

                    return (
                      <div key={item.id || idx} className="space-y-1 rounded-xl bg-[#FAFAFB] p-3.5">
                        {category && <div className="text-xs text-[#005CAD]">{category}</div>}
                        <h3 className="text-sm font-semibold text-[#191C1E]">{item.title}</h3>
                        <p className="text-xs leading-relaxed text-[#5C6370]">{bodyText}</p>
                        {item.publishedAt && (
                          <span className="sr-only">
                            {dayjs.utc(item.publishedAt).format('D MMM YYYY')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
            {/* Accessible prayer library link */}
            <Link href={`/churches/${churchId}/prayers`} className="sr-only">
              {t('viewPrayers')}
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Scripture banner */}
      <div className="mx-auto max-w-[1152px] px-4 pb-12 sm:px-6">
        <section className="rounded-2xl border border-[#DDE0E4] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:p-6">
          <div className="space-y-3 rounded-xl bg-[#F5F7FF] p-6 text-center sm:p-8">
            <div className="flex justify-center text-[#2F7AD2]">
              <SparklesIcon className="text-2xl" />
            </div>
            <blockquote className="mx-auto max-w-2xl font-font_quote text-2xl italic leading-relaxed text-[#0B4497] sm:text-3xl">
              &ldquo;{t('scriptureQuote')}&rdquo;
            </blockquote>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5C6370]">
              {t('scriptureRef')} • IN FELLOWSHIP WITH EELK TALLINN DEANERY
            </p>
          </div>
        </section>
      </div>

      {/* Transcript modal */}
      {transcriptModal && (
        <Modal
          open={!!transcriptModal}
          onCancel={() => setTranscriptModal(null)}
          footer={null}
          title={transcriptModal.title}
          centered
        >
          <div className="py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5C6370]">
              {transcriptModal.body}
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
