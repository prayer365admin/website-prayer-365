'use client'

import axios from 'axios'
import AudioPlayer, { AudioPlayerLabels } from '@/components/site/prayer/audio-player'
import { AlignLeftIcon } from '@/components/icon/align-left'
import Link from 'next/link'
import { useRef } from 'react'

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
    void track('prayer_listen', crypto.randomUUID())
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

  const labels: AudioPlayerLabels = {
    play: 'Play prayer audio',
    pause: 'Pause prayer audio',
    back10: 'Go back 10 seconds',
    forward10: 'Go forward 10 seconds',
    rate: (rate) => `Playback speed ${rate} times`,
    mute: 'Mute prayer audio',
    unmute: 'Unmute prayer audio',
    download: 'Download prayer audio',
  }

  return (
    <AudioPlayer
      labels={labels}
      onEnded={(audio) => trackListening(audio, true)}
      onPause={(audio) => trackListening(audio, true)}
      onPlayStart={reportListen}
      onSeekEnd={(audio) => {
        listened.current.last = audio.currentTime
        seeking.current = false
      }}
      onSeekStart={() => {
        seeking.current = true
      }}
      onTimeUpdate={(audio) => trackListening(audio)}
      renderFooter={
        showTranscript
          ? () => (
              <Link
                className="ml-auto inline-flex h-8 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-xs sm:ml-0 font-semibold text-blue-800 transition hover:border-primary-300"
                href={`/prayers/${prayerSlug}`}
              >
                <AlignLeftIcon className="text-base" />
                Read transcript
              </Link>
            )
          : undefined
      }
      seed={prayerId}
      src={src}
    />
  )
}
