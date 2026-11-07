'use client'

import { CaretRightFilled } from '@/components/icon/antd-icons'
import { useSiteI18n } from '@/i18n/site-i18n'
import { PauseOutlined } from '@ant-design/icons'
import { useRef, useState } from 'react'

const BAR_COUNT = 76

// Deterministic pseudo-waveform so the server and the client render identical bars.
const WAVEFORM_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, index) => {
  const envelope = Math.sin((index / BAR_COUNT) * Math.PI)
  const noise = ((index * 37) % 19) / 19
  return Math.round(5 + envelope * 13 + noise * 9)
})

function formatSeconds(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export default function WelcomePrayerPlayer({
  audioUrl,
  title,
}: {
  audioUrl?: string | null
  title?: string
}) {
  const { t } = useSiteI18n()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const hasAudio = Boolean(audioUrl)

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
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (audio) setCurrentTime(audio.currentTime)
  }

  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (audio) setDuration(audio.duration)
  }

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="flex w-full items-center gap-2">
      {hasAudio && (
        <audio
          onEnded={() => setPlaying(false)}
          onError={() => setPlaying(false)}
          onLoadedMetadata={handleLoadedMetadata}
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
          {WAVEFORM_HEIGHTS.map((height, index) => {
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
