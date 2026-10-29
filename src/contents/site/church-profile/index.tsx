'use client'

import { useEffect, useRef, useState } from 'react'
import { ChurchIcon } from '@/components/icon/church'
import { SparklesIcon } from '@/components/icon/sparkles'
import { WaveformIcon } from '@/components/icon/waveform'
import { DonationBanner } from '@/components/site/donation-banner'
import { useSiteChurchPrayers, useSiteChurchProfile } from '@/hooks/data/site/churches'
import { useSiteHome } from '@/hooks/data/site/home'
import { useMe, useMyChurches } from '@/hooks/data/site/me'
import { useSiteI18n } from '@/i18n/site-i18n'
import type { MobilePublishedPrayer } from '@/models/mobile'
import {
  CaretRightFilled,
  EnvironmentOutlined,
  MailOutlined,
  PauseOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { Alert, Button, Skeleton, Typography } from 'antd'
import axios from 'axios'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import Image from 'next/image'
import Link from 'next/link'
import { Hero } from './hero'
import { GoogleMapPins } from '@/components/common/google-map'
import { SectionCard } from './section-card'
import { Stewardship } from './stewardship'
import { DownloadIcon } from '@/components/icon/download'
import { TranscriptIcon } from '@/components/icon/transcript'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
dayjs.extend(utc)
dayjs.extend(timezone)

interface PrayerAudioRowProps {
  prayer: MobilePublishedPrayer
  isActive: boolean
  onTogglePlay: () => void
  pastorFallback: string
  churchName: string
}

function PrayerAudioRow({
  prayer,
  isActive,
  onTogglePlay,
  pastorFallback,
  churchName,
}: PrayerAudioRowProps) {
  const { t } = useSiteI18n()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(60)

  // No approved audio → no playback. Never substitute a sample file.
  const audioSrc = prayer.audio?.assetUrl ?? null

  useEffect(() => {
    if (!audioRef.current) return
    if (isActive && audioSrc) {
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
    }
  }, [isActive, audioSrc])

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
      {audioSrc && (
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
      )}
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#2F7AD2] uppercase">
        <WaveformIcon className="text-sm text-[#2F7AD2]" />
        <span>{t('guidedContemplation')}</span>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!audioSrc}
            aria-label={!audioSrc ? t('noAudioAvailable') : isActive ? 'Pause' : 'Play'}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2F7AD2] text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
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
          {audioSrc && (
            <a
              href={audioSrc}
              download={`${prayer.version.title}.mp3`}
              target="_blank"
              rel="noopener noreferrer"
              title={t('downloadAudio')}
              aria-label={t('downloadAudio')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE0E4] bg-white text-[#2F7AD2] transition-colors hover:bg-[#F4F7FC] hover:border-[#2F7AD2]"
            >
              <DownloadIcon className="h-4 w-4" />
            </a>
          )}
          <Link
            href={`/prayers/${prayer.id}`}
            title={t('viewTranscript')}
            aria-label={t('viewTranscript')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE0E4] bg-white text-[#2F7AD2] transition-colors hover:bg-[#F4F7FC] hover:border-[#2F7AD2]"
          >
            <TranscriptIcon className="h-4 w-4" />
          </Link>
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

function PastorAvatar({
  name,
  imageUrl,
  round = false,
}: {
  name: string
  imageUrl?: string | null
  round?: boolean
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const currentImageUrl = imageUrl && imageUrl !== failedImageUrl ? imageUrl : null

  return (
    <div
      className={`flex size-12 shrink-0 items-center justify-center overflow-hidden bg-[#E6EDFB] text-xl font-semibold text-[#2F7AD2] ${round ? 'rounded-full' : 'rounded-xl'}`}
    >
      {currentImageUrl ? (
        <Image
          alt={name}
          className="size-12 object-cover"
          height={256}
          onError={() => setFailedImageUrl(currentImageUrl)}
          src={currentImageUrl}
          unoptimized
          width={256}
        />
      ) : (
        <span>{getStaffInitials(name)}</span>
      )}
    </div>
  )
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

export default function ContentsSiteChurchProfile({ slug }: { slug: string }) {
  const { t } = useSiteI18n()
  const { data, loading, error, retry } = useSiteChurchProfile(slug)
  const { data: prayers = [], loading: prayersLoading } = useSiteChurchPrayers(slug)
  const { data: homeData } = useSiteHome()
  const isPrimaryParish = homeData?.mainChurch?.id === data?.id
  const { data: myChurches = [], onFollow, following: followPending } = useMyChurches()
  const list = Array.isArray(myChurches) ? myChurches : []
  const churchRelation = list.find((c) => c?.churchId === data?.id)
  const isFollowed = Boolean(churchRelation?.isFollowed || isPrimaryParish)

  const { onPatch, patching: setMainPending } = useMe()

  const handleToggleFollow = async () => {
    if (isPrimaryParish || !data?.id) return
    try {
      await onFollow({ churchId: data.id, isFollowed: !isFollowed })
    } catch {
      // query error handled by react-query
    }
  }

  const handleSetMainChurch = async () => {
    if (isPrimaryParish || !data?.id) return
    try {
      await onPatch({ mainChurchId: data.id })
    } catch {
      // query error handled by react-query
    }
  }
  const [activePrayerId, setActivePrayerId] = useState<string | null>(null)

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
      <Hero
        church={data}
        isPrimaryParish={isPrimaryParish}
        isFollowed={isFollowed}
        isFollowPending={followPending}
        onToggleFollow={handleToggleFollow}
        isSetMainPending={setMainPending}
        onSetMainChurch={handleSetMainChurch}
      />

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
                  <div className="relative shrink-0">
                    <PastorAvatar
                      imageUrl={data.pastorImageUrl}
                      name={data.pastorName || data.name}
                      round
                    />
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

            {/* Worship Services card */}
            <SectionCard
              title={t('worshipServices')}
              subtitle={t('serviceTimes')}
              bodyClassName="divide-y divide-[#DDE0E4] p-0"
            >
              {worshipServices.length === 0 ? (
                <div className="m-4 rounded-xl border border-dashed border-[#DDE0E4] bg-[#FAFAFB] p-6 text-center text-sm text-[#5C6370]">
                  {t('noWorshipServices')}
                </div>
              ) : (
                worshipServices.map((st, i) => {
                  const weekdayName = WEEKDAYS[(st.weekday - 1 + 7) % 7] ?? 'Sunday'
                  const serviceTitle = st.label || weekdayName
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
                            {weekdayName.toUpperCase()}
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

            {/* Prayer Lists card */}
            {(prayersLoading || prayerList.length > 0) && (
              <SectionCard
                title={t('prayerLists')}
                subtitle={t('guidedContemplation')}
                bodyClassName="divide-y divide-[#DDE0E4] p-0"
              >
                {prayersLoading ? (
                  <div className="p-6">
                    <Skeleton active paragraph={{ rows: 4 }} />
                  </div>
                ) : (
                  prayerList.map((prayer) => (
                    <PrayerAudioRow
                      key={prayer.id}
                      prayer={prayer}
                      isActive={activePrayerId === prayer.id}
                      onTogglePlay={() => {
                        setActivePrayerId((prev) => (prev === prayer.id ? null : prayer.id))
                      }}
                      pastorFallback={data.pastorName || ''}
                      churchName={data.name}
                    />
                  ))
                )}
              </SectionCard>
            )}

            {/* Sanctuary Gallery card */}
            <SectionCard title={t('sanctuaryGallery')} subtitle={t('sacredArtHeritage')}>
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
                  activeId={data.id}
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
                    return (
                      <div
                        key={idx}
                        className="flex h-16 items-center justify-between rounded-lg bg-[#FAFAFB] p-2"
                      >
                        <div className="flex items-center gap-2">
                          <PastorAvatar imageUrl={person.imageUrl} name={person.name} />
                          <div>
                            <div className="text-base font-semibold leading-snug text-[#0E203E]">
                              {person.name}
                            </div>
                            <div className="text-xs text-[#0B4497]">{person.pastoralRole}</div>
                          </div>
                        </div>
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
                      {t('parishSecretary')}:{' '}
                      <a
                        href={`tel:${data.contacts.phone}`}
                        className="text-[#5C6370] hover:underline"
                      >
                        {data.contacts.phone}
                      </a>
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
            <Stewardship slug={data.slug} churchName={data.name} />
          </div>
        </div>
      </div>

      {/* 5. Donation banner */}
      <div className="mx-auto max-w-[1152px] px-4 pb-12 sm:px-6">
        <DonationBanner
          body={t('donationBannerBody')}
          ctaLabel={t('donationBannerCta')}
          href={`/donate?church=${data.slug}`}
        />
      </div>
    </div>
  )
}
