'use client'

import { CaretRightFilled } from '@/components/icon/antd-icons'
import { useSiteI18n } from '@/i18n/site-i18n'
import { PauseOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { waveformBars } from '@/utils/audio-waveform'

const BAR_COUNT = 76

function formatSeconds(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export default function WelcomePrayerPlayer({
  audioUrl,
  title,
  seed = 'welcome',
}: {
  audioUrl?: string | null
  title?: string
  /** Stable content id so the decorative wave differs per prayer and matches SSR. */
  seed?: string
}) {
  const { t } = useSiteI18n()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Same generator as the dashboard and reader players, seeded by the prayer so the
  // card and the reader page show the same shape for the same recording.
  const wave = useMemo(() => waveformBars({ count: BAR_COUNT, min: 4, range: 30, seed }), [seed])
  const hasAudio = Boolean(audioUrl)

  /**
   * Read the real length from the element.
   *
   * `loadedmetadata` can fire BEFORE React attaches its listener (the element starts
   * loading the moment `src` is committed), which used to leave `duration` at 0: the
   * audio played while the progress stayed on the first bar. Every event that can
   * carry the value calls this, and so does each time update, so the state heals
   * itself instead of depending on one event that may already be gone.
   */
  const syncDuration = () => {
    const value = audioRef.current?.duration
    if (value && Number.isFinite(value) && value > 0) setDuration(value)
  }

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    try {
      await audio.play()
      syncDuration()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
    syncDuration()
  }

  // Same guard as the reader page: metadata may already be loaded at mount.
  useEffect(() => {
    if ((audioRef.current?.readyState ?? 0) >= 1) syncDuration()
  }, [])

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="flex w-full items-center gap-2">
      {hasAudio && (
        <audio
          onEnded={() => setPlaying(false)}
          onError={() => setPlaying(false)}
          onCanPlay={syncDuration}
          onDurationChange={syncDuration}
          onLoadedData={syncDuration}
          onLoadedMetadata={syncDuration}
          onTimeUpdate={handleTimeUpdate}
          preload="metadata"
          ref={audioRef}
          src={audioUrl ?? undefined}
        />
      )}

      <button
        aria-label={
          hasAudio
            ? t(playing ? 'welcomePlayerPause' : 'welcomePlayerPlay', { title: title ?? '' })
            : t('welcomePlayerUnavailable')
        }
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-colors ${
          hasAudio
            ? 'bg-[#2F7AD2] text-white hover:bg-[#256bb8] cursor-pointer'
            : 'bg-[#2F7AD2]/40 text-white cursor-not-allowed'
        }`}
        disabled={!hasAudio}
        onClick={togglePlayback}
        type="button"
      >
        {playing ? (
          <PauseOutlined className="text-[16px]" />
        ) : (
          <CaretRightFilled className="text-[16px] ml-0.5" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 self-stretch">
        <div aria-hidden className="flex h-[34px] items-end gap-[2px]">
          {wave.map((height, index) => {
            const barProgress = (index / BAR_COUNT) * 100
            const isPlayed = hasAudio && barProgress <= progressPercent
            return (
              <span
                className={`flex-1 rounded-full transition-colors ${
                  isPlayed ? 'bg-[#2F7AD2]' : 'bg-black/15'
                }`}
                key={index}
                style={{ height: `${height}px` }}
              />
            )
          })}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/15">
          <div
            className="h-full rounded-full bg-[#2F7AD2] transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <span className="sr-only">
          {hasAudio
            ? t('welcomePlayerProgress', {
                current: formatSeconds(currentTime),
                duration: formatSeconds(duration),
              })
            : t('welcomePlayerUnavailable')}
        </span>
      </div>
    </div>
  )
}
