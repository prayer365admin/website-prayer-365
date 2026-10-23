'use client'

import { PauseOutlined } from '@ant-design/icons'
import axios from 'axios'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}

const BARS = 112
const LISTEN_REMAINDER_PREFIX = 'prayer-listen-remainder'

type ListenRemainder = {
  pendingKey: string | null
  seconds: number
  week: string
}

const weekKey = (date = new Date()) => {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return new Date(midnight - ((date.getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

const remainderKey = (userId: string) => `${LISTEN_REMAINDER_PREFIX}:${userId}`

const emptyRemainder = (): ListenRemainder => ({ pendingKey: null, seconds: 0, week: weekKey() })

const readRemainder = (userId: string): ListenRemainder | null => {
  try {
    const raw = window.localStorage.getItem(remainderKey(userId))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (
      !value ||
      typeof value !== 'object' ||
      !('week' in value) ||
      value.week !== weekKey() ||
      !('seconds' in value) ||
      typeof value.seconds !== 'number' ||
      !Number.isFinite(value.seconds) ||
      value.seconds < 0
    ) {
      return null
    }
    return {
      pendingKey:
        'pendingKey' in value && typeof value.pendingKey === 'string' ? value.pendingKey : null,
      seconds: value.seconds,
      week: value.week,
    }
  } catch {
    return null
  }
}

const writeRemainder = (userId: string, value: ListenRemainder) => {
  try {
    window.localStorage.setItem(remainderKey(userId), JSON.stringify(value))
  } catch {
    // Playback and analytics must continue when browser storage is unavailable.
  }
}

/** Random-looking bar heights (4–46px), seeded by prayer ID so server and client render the same wave. */
const randomWave = (seed: string) => {
  let state = seed
    .split('')
    .reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261)
  return Array.from({ length: BARS }, () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507) + 0x6d2b79f5
    return 4 + (((state >>> 0) % 1000) / 1000) * 42
  })
}

const icon = (src: string, size = 20) => (
  <Image alt="" aria-hidden height={size} src={src} width={size} />
)

// `enabled:` keeps hover feedback off the controls of a prayer without audio.
const disabledControl = 'disabled:cursor-not-allowed disabled:opacity-50'
const squareButton = `flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white transition enabled:hover:border-primary-300 ${disabledControl}`

export default function DevotionalAudioPlayer({
  prayerId,
  prayerSlug,
  src,
  userId,
  showTranscript = true,
}: {
  prayerId: string
  /** Stable public identifier used by the website transcript route. */
  prayerSlug: string
  /** null = the prayer has no approved audio: every control is disabled except Read transcript (same when the file fails to load). */
  src: string | null
  /** Keeps unfinished listened seconds isolated to the authenticated member. */
  userId: string
  /** Off on the prayer detail page, where the full text is already shown. */
  showTranscript?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const listenReported = useRef(false)
  const seeking = useRef(false)
  // Wall-clock seconds actually played this page view, and minutes already reported.
  const listened = useRef({
    last: 0,
    loaded: false,
    pendingKey: null as string | null,
    reporting: false,
    seconds: 0,
    week: '',
  })
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  // The file behind an approved audio can still be missing (e.g. seeded demo keys).
  const [failed, setFailed] = useState(false)
  const unavailable = !src || failed
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [wave] = useState(() => randomWave(prayerId))
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

  // Analytics must never block playback, so failures are ignored.
  const track = (eventType: 'prayer_listen' | 'prayer_listen_minute', eventKey: string) =>
    axios
      .post('/api/v1/site/analytics-events', {
        events: [
          { eventKey, eventType, occurredAt: new Date().toISOString(), resourceId: prayerId },
        ],
      })
      .then(() => true)
      .catch(() => false)

  const reportListen = () => {
    if (listenReported.current) return
    listenReported.current = true
    track('prayer_listen', crypto.randomUUID())
  }

  const persistListening = () => {
    const state = listened.current
    writeRemainder(userId, {
      pendingKey: state.pendingKey,
      seconds: state.seconds,
      week: state.week,
    })
  }

  const loadListening = () => {
    const state = listened.current
    if (state.loaded) return
    const stored = readRemainder(userId) ?? emptyRemainder()
    state.loaded = true
    state.pendingKey = stored.pendingKey
    state.seconds = stored.seconds
    state.week = stored.week
  }

  const reportMinutes = async () => {
    const state = listened.current
    if (state.reporting) return
    state.reporting = true
    while (state.seconds >= 60) {
      state.pendingKey ||= crypto.randomUUID()
      const eventKey = state.pendingKey
      persistListening()
      if (!(await track('prayer_listen_minute', eventKey))) break

      // Re-read before subtracting so a navigation or another player cannot overwrite seconds
      // accumulated while this request was in flight. The stable key keeps retries idempotent.
      const latest = readRemainder(userId)
      if (latest?.pendingKey === eventKey) {
        state.seconds = Math.max(0, latest.seconds - 60)
        state.pendingKey = null
        state.week = latest.week
        persistListening()
      } else if (latest) {
        state.seconds = latest.seconds
        state.pendingKey = latest.pendingKey
        state.week = latest.week
      } else {
        state.seconds = Math.max(0, state.seconds - 60)
        state.pendingKey = null
      }
    }
    state.reporting = false
  }

  /**
   * Feeds Home "mins this week": unfinished seconds persist across prayers and page visits, and one
   * prayer_listen_minute is recorded whenever their total reaches 60. Uses wall-clock playback time,
   * so faster playback does not inflate the metric; jumps from seeking are skipped.
   */
  const trackListening = (audio: HTMLAudioElement, allowPaused = false) => {
    const state = listened.current
    loadListening()
    if (state.week !== weekKey()) {
      state.pendingKey = null
      state.seconds = 0
      state.week = weekKey()
    }
    const delta = (audio.currentTime - state.last) / (audio.playbackRate || 1)
    state.last = audio.currentTime
    if ((!allowPaused && audio.paused) || seeking.current || delta <= 0) return
    state.seconds += delta
    persistListening()
    if (state.seconds >= 60) void reportMinutes()
  }

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
        setPlaying(true)
        reportListen()
      } catch {
        setPlaying(false)
      }
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(duration || audio.duration || 0, value))
    listened.current.last = audio.currentTime
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
    // A disabled fieldset disables every button and input inside it; Read transcript is a link, so it stays usable.
    <fieldset className="mt-5 min-w-0 border-0 p-0 sm:mt-7" disabled={unavailable}>
      {src && (
        <audio
          onDurationChange={syncDuration}
          onEnded={(event) => {
            trackListening(event.currentTarget, true)
            setPlaying(false)
          }}
          onError={() => setFailed(true)}
          onLoadedMetadata={syncDuration}
          onPause={(event) => {
            trackListening(event.currentTarget, true)
            setPlaying(false)
          }}
          onPlay={() => setPlaying(true)}
          onSeeked={(event) => {
            listened.current.last = event.currentTarget.currentTime
            seeking.current = false
          }}
          onSeeking={() => {
            seeking.current = true
          }}
          onTimeUpdate={(event) => {
            setCurrent(event.currentTarget.currentTime)
            trackListening(event.currentTarget)
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
            aria-label={playing ? 'Pause prayer audio' : 'Play prayer audio'}
            className={`mr-2 flex size-12 items-center justify-center rounded-xl bg-primary-500 text-lg text-white transition enabled:hover:bg-primary-700 ${disabledControl} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500`}
            onClick={toggle}
            type="button"
          >
            {playing ? <PauseOutlined /> : icon('/icons/icon-play-button.svg', 24)}
          </button>
          <button
            aria-label="Go back 10 seconds"
            className={`flex size-8 items-center justify-center rounded-lg transition enabled:hover:bg-primary-100 ${disabledControl}`}
            onClick={() => seek(current - 10)}
            type="button"
          >
            {icon('/icons/Icon-rewind.svg')}
          </button>
          <button
            aria-label="Go forward 10 seconds"
            className={`flex size-8 items-center justify-center rounded-lg transition enabled:hover:bg-primary-100 ${disabledControl}`}
            onClick={() => seek(current + 10)}
            type="button"
          >
            {icon('/icons/Icon-forward.svg')}
          </button>
          <button
            aria-label={`Playback speed ${rate} times`}
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
            aria-label={muted ? 'Unmute prayer audio' : 'Mute prayer audio'}
            aria-pressed={muted}
            className={squareButton}
            onClick={toggleMute}
            type="button"
          >
            {icon(muted ? '/icons/Icon-sound-off.svg' : '/icons/Icon-sound.svg', 18)}
          </button>
          {!unavailable ? (
            <a aria-label="Download prayer audio" className={squareButton} download href={src}>
              {icon('/icons/icon-download.svg', 18)}
            </a>
          ) : (
            <button aria-label="Download prayer audio" className={squareButton} type="button">
              {icon('/icons/icon-download.svg', 18)}
            </button>
          )}
          {showTranscript && (
            <Link
              className="ml-auto inline-flex h-8 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-xs sm:ml-0 font-semibold text-blue-800 transition hover:border-primary-300"
              href={`/prayers/${prayerSlug}`}
            >
              {icon('/icons/Icon-align-left.svg', 16)}
              Read transcript
            </Link>
          )}
        </div>
      </div>
    </fieldset>
  )
}
