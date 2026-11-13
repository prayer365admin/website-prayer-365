'use client'

import { PauseOutlined } from '@ant-design/icons'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { waveformBars } from '@/utils/audio-waveform'

/*
 * Presentational prayer audio player (WB-34/35). Owns the media element, the
 * wave/progress/seek controls and their state only. Analytics (listen events,
 * weekly remainders) and the transcript link stay in `DevotionalAudioPlayer`,
 * which composes this and observes it through the callbacks below.
 */

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}

const BARS = 112

const icon = (src: string, size = 20) => (
  <Image alt="" aria-hidden height={size} src={src} width={size} />
)

// `enabled:` keeps hover feedback off the controls of a prayer without audio.
const disabledControl = 'disabled:cursor-not-allowed disabled:opacity-50'
const squareButton = `flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white transition enabled:hover:border-primary-300 ${disabledControl}`

export type AudioPlayerLabels = {
  play: string
  pause: string
  back10: string
  forward10: string
  rate: (rate: number) => string
  mute: string
  unmute: string
  download: string
}

export default function AudioPlayer({
  src,
  seed,
  labels,
  renderFooter,
  onPlayStart,
  onPause,
  onSeekStart,
  onSeekEnd,
  onTimeUpdate,
  onEnded,
  disabled = false,
}: {
  /** null = no playable audio: every control is disabled. */
  src: string | null
  /** Stable identifier seeding the decorative wave so SSR and hydration match. */
  seed: string
  labels: AudioPlayerLabels
  /** Extra control rendered after Download in the bottom row (transcript link …). */
  renderFooter?: () => React.ReactNode
  onPlayStart?: () => void
  onPause?: (audio: HTMLAudioElement) => void
  onSeekStart?: () => void
  onSeekEnd?: (audio: HTMLAudioElement) => void
  onTimeUpdate?: (audio: HTMLAudioElement) => void
  onEnded?: (audio: HTMLAudioElement) => void
  /** Disables the controls (e.g. a failed load) without removing them. */
  disabled?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const seeking = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  // The file behind a READY audio can still be missing (e.g. seeded demo keys).
  const [failed, setFailed] = useState(false)
  const unavailable = !src || failed || disabled
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [wave] = useState(() => waveformBars({ count: BARS, seed }))
  const progress = duration > 0 ? Math.min(current / duration, 1) : 0

  const syncDuration = () => {
    const value = audioRef.current?.duration
    if (value && Number.isFinite(value)) setDuration(value)
  }

  // Metadata can load before hydration attaches the media handlers below, so read it once on mount.
  useEffect(() => {
    if ((audioRef.current?.readyState ?? 0) >= 1) syncDuration()
    if (audioRef.current?.error) setFailed(true)
  }, [])

  // timeupdate fires only ~4x/second; follow playback every frame so the progress moves smoothly.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      if (audioRef.current) setCurrent(audioRef.current.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
        setPlaying(true)
        onPlayStart?.()
      } catch {
        setPlaying(false)
      }
    } else {
      audio.pause()
      setPlaying(false)
      onPause?.(audio)
    }
  }

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(duration || audio.duration || 0, value))
    setCurrent(audio.currentTime)
  }

  const cycleRate = () => {
    const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }

  return (
    // A disabled fieldset disables every button and input inside it; a footer link stays usable.
    <fieldset className="mt-5 min-w-0 border-0 p-0 sm:mt-7" disabled={unavailable}>
      {src && (
        <audio
          onDurationChange={syncDuration}
          onEnded={(event) => {
            setPlaying(false)
            onEnded?.(event.currentTarget)
          }}
          onError={() => setFailed(true)}
          onLoadedMetadata={syncDuration}
          onPause={(event) => {
            setPlaying(false)
            onPause?.(event.currentTarget)
          }}
          onPlay={() => setPlaying(true)}
          onSeeked={() => {
            seeking.current = false
            onSeekEnd?.(audioRef.current!)
          }}
          onSeeking={() => {
            seeking.current = true
            onSeekStart?.()
          }}
          onTimeUpdate={(event) => {
            setCurrent(event.currentTarget.currentTime)
            onTimeUpdate?.(event.currentTarget)
          }}
          preload="metadata"
          ref={audioRef}
          src={src}
        />
      )}
      <div className="relative">
        <div aria-hidden="true" className="flex h-12 items-end justify-between overflow-hidden">
          {wave.map((height, index) => (
            <span
              className={
                (index + 1) / wave.length <= progress ? 'bg-primary-500' : 'bg-[#00000026]'
              }
              key={`${height}-${index}`}
              style={{ height, width: 1 }}
            />
          ))}
        </div>
        <div aria-hidden="true" className="mt-1 h-1 overflow-hidden rounded-full bg-[#00000026]">
          <div
            className="h-full bg-primary-500"
            data-testid="audio-progress"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <input
          aria-label="Prayer audio position"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          disabled={!duration}
          max={duration}
          min={0}
          onChange={(event) => seek(Number(event.target.value))}
          step={0.1}
          type="range"
          value={Math.min(current, duration)}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs font-medium text-neutral-600">
        <span>{formatTime(current)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button
            aria-label={playing ? labels.pause : labels.play}
            className={`mr-2 flex size-12 items-center justify-center rounded-xl bg-primary-500 text-lg text-white transition enabled:hover:bg-primary-700 ${disabledControl} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500`}
            onClick={toggle}
            type="button"
          >
            {playing ? <PauseOutlined /> : icon('/icons/icon-play-button.svg', 24)}
          </button>
          <button
            aria-label={labels.back10}
            className={`flex size-8 items-center justify-center rounded-lg transition enabled:hover:bg-primary-100 ${disabledControl}`}
            onClick={() => seek(current - 10)}
            type="button"
          >
            {icon('/icons/Icon-rewind.svg')}
          </button>
          <button
            aria-label={labels.forward10}
            className={`flex size-8 items-center justify-center rounded-lg transition enabled:hover:bg-primary-100 ${disabledControl}`}
            onClick={() => seek(current + 10)}
            type="button"
          >
            {icon('/icons/Icon-forward.svg')}
          </button>
          <button
            aria-label={labels.rate(rate)}
            className={`ml-auto inline-flex h-8 items-center gap-1 rounded-full sm:ml-2 border border-neutral-200 bg-white px-3 text-xs font-semibold text-blue-800 transition enabled:hover:border-primary-300 ${disabledControl}`}
            onClick={cycleRate}
            type="button"
          >
            {icon('/icons/Icon-fast-forward.svg', 16)}
            {rate}X
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-neutral-200/70 pt-3 sm:border-0 sm:pt-0">
          <button
            aria-label={muted ? labels.unmute : labels.mute}
            aria-pressed={muted}
            className={squareButton}
            onClick={toggleMute}
            type="button"
          >
            {icon(muted ? '/icons/Icon-sound-off.svg' : '/icons/Icon-sound.svg', 18)}
          </button>
          {!unavailable ? (
            <a aria-label={labels.download} className={squareButton} download href={src!}>
              {icon('/icons/icon-download.svg', 18)}
            </a>
          ) : (
            <button aria-label={labels.download} className={squareButton} type="button">
              {icon('/icons/icon-download.svg', 18)}
            </button>
          )}
          {renderFooter?.()}
        </div>
      </div>
    </fieldset>
  )
}
