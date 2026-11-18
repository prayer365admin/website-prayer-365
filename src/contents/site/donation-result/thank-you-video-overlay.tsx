'use client'

import Image from 'next/image'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useCallback, useEffect, useRef, useState } from 'react'

const MUTED_STORAGE_KEY = 'thankyou_video_muted'

// Opening 12 s of the soundtrack, trimmed to a loop-free bed with baked fades.
// Kept separate from the video so changing the music never re-encodes video.
const SOUNDTRACK_SRC = '/videos/thankyou-opening.mp3'
const SOUNDTRACK_SECONDS = 12

function readMutedPreference(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(MUTED_STORAGE_KEY)
    return value === '1' ? true : value === '0' ? false : null
  } catch {
    return null
  }
}

function writeMutedPreference(muted: boolean) {
  try {
    window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // Storage disabled: preference just is not remembered.
  }
}

// jsdom and some embedded browsers return undefined here; never assume a promise.
function playMedia(media: HTMLMediaElement) {
  try {
    const result = media.play()
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch {
    // Playback unavailable: the overlay still renders.
  }
}

export interface ThankYouVideoOverlayProps {
  onComplete?: () => void
}

export default function ThankYouVideoOverlay({ onComplete }: ThankYouVideoOverlayProps) {
  const { t } = useSiteI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const playAttemptedRef = useRef(false)
  const endingRef = useRef(false)
  const audioUnlockCleanupRef = useRef<(() => void) | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  const handleToggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    // An explicit choice wins over the first-tap auto-unlock.
    audioUnlockCleanupRef.current?.()
    audioUnlockCleanupRef.current = null
    const nextMuted = !audio.muted
    audio.muted = nextMuted
    setIsMuted(nextMuted)
    writeMutedPreference(nextMuted)
    if (!nextMuted) playMedia(audio)
  }, [])

  const handleEnd = useCallback(() => {
    if (endingRef.current) return
    endingRef.current = true
    setIsFading(true)
    const timer = setTimeout(() => {
      setIsDismissed(true)
      onComplete?.()
    }, 1000)
    return () => clearTimeout(timer)
  }, [onComplete])

  const handleSkip = useCallback(() => {
    if (endingRef.current) return
    endingRef.current = true
    setIsFading(true)
    const timer = setTimeout(() => {
      setIsDismissed(true)
      onComplete?.()
    }, 600)
    return () => clearTimeout(timer)
  }, [onComplete])

  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (!video || !audio) return

    // Keep the toggle in sync with the real element (also covers StrictMode
    // double-invocation and any later programmatic mute).
    const syncMuted = () => setIsMuted(audio.muted)
    audio.addEventListener('volumechange', syncMuted)

    const startedAt = performance.now()

    // Chrome blocks unmuted autoplay after an external redirect and pauses a
    // muted-playing element the moment script unmutes it. The only way to start
    // sound is user activation, so unmute on the first interaction that is not
    // the explicit sound/skip controls (their own click semantics stay intact).
    function disposeAudioUnlock() {
      window.removeEventListener('pointerdown', unlockAudio, true)
      window.removeEventListener('keydown', unlockAudio, true)
      window.removeEventListener('touchstart', unlockAudio, true)
      if (audioUnlockCleanupRef.current === disposeAudioUnlock) {
        audioUnlockCleanupRef.current = null
      }
    }

    function unlockAudio(event: Event) {
      if (!audio) return
      const target = event.target
      if (target instanceof Element && target.closest('[data-thankyou-controls]')) return
      disposeAudioUnlock()
      audio.muted = false
      setIsMuted(false)
      playMedia(audio)
    }

    const armAudioUnlock = () => {
      audioUnlockCleanupRef.current = disposeAudioUnlock
      window.addEventListener('pointerdown', unlockAudio, true)
      window.addEventListener('keydown', unlockAudio, true)
      window.addEventListener('touchstart', unlockAudio, true)
    }

    if (!playAttemptedRef.current) {
      playAttemptedRef.current = true
      // The visual track is always silent; sound lives in its own element.
      video.muted = true
      playMedia(video)

      if (readMutedPreference() === true) {
        // Visitor muted a previous thank-you screen: stay muted. State already
        // starts muted, so no sync needed here.
        audio.muted = true
        playMedia(audio)
      } else {
        try {
          // Sound plays by default. Try unmuted autoplay first; browsers block it
          // without a user gesture, so fall back to muted playback rather than a
          // stalled soundtrack.
          audio.muted = false
          const promise = audio.play()
          if (promise && typeof promise.then === 'function') {
            promise.then(
              () => setIsMuted(false),
              () => {
                // Autoplay policy fallback: play muted. This does not touch the
                // stored preference; only an explicit toggle does.
                audio.muted = true
                setIsMuted(true)
                playMedia(audio)
                armAudioUnlock()
              },
            )
          }
        } catch {
          // Fallback for environments lacking media playback
        }
      }
    }

    let rafId: number
    const updateLoop = () => {
      const time = video.currentTime
      setCurrentTime(time)
      // The visual track is 10 s; the soundtrack is longer, so the overlay
      // lifetime follows wall clock, not the video element.
      const elapsed = (performance.now() - startedAt) / 1000
      const total =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : SOUNDTRACK_SECONDS
      if (elapsed >= total - 0.8 && !isFading) {
        handleEnd()
      }
      rafId = requestAnimationFrame(updateLoop)
    }

    rafId = requestAnimationFrame(updateLoop)
    return () => {
      cancelAnimationFrame(rafId)
      audio.removeEventListener('volumechange', syncMuted)
      disposeAudioUnlock()
    }
  }, [handleEnd, isFading])

  if (isDismissed) return null

  // Timestamps matching storyboard panels:
  // 0:00 - 0:01 -> Step 1 ("Hea, et oled siin.")
  // 0:01 - 0:02 -> Step 2 (open hands, clean video)
  // 0:02 - 0:03 -> Step 3 (prayer hands, clean video)
  // 0:03 - 0:05 -> Step 4 ("Aitäh Sinu annetuse eest. Jumal õnnistagu Sind. 🙏")
  // 0:05 - 0:06 -> Step 5 (Prayer 365 app icon + brand)
  // 0:06 - 0:07+ -> Step 6 ("Iga päev palves. Iga päev koos.")
  const showStep1 = currentTime < 1.0
  const showStep4 = currentTime >= 3.0 && currentTime < 5.0
  const showStep5 = currentTime >= 5.0 && currentTime < 6.0
  const showStep6 = currentTime >= 6.0

  return (
    <div
      aria-label={t('thankYouVideoRegion')}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black transition-opacity duration-1000 ease-out ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      role="region"
    >
      <video
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        preload="auto"
        ref={videoRef}
        src="/videos/thankyou.webm"
      />
      <audio
        autoPlay
        className="hidden"
        onEnded={handleEnd}
        preload="auto"
        ref={audioRef}
        src={SOUNDTRACK_SRC}
      />

      {/* Subtle overlay shading for guaranteed text contrast across cloud/sun changes */}
      <div className="pointer-events-none absolute inset-0 bg-white/10 backdrop-blur-[0.5px]" />

      {/* Top-right controls: mute toggle + skip */}
      <div className="absolute right-5 top-5 z-20 flex items-center gap-2" data-thankyou-controls>
        <button
          aria-label={isMuted ? t('thankYouVideoSoundOnAria') : t('thankYouVideoSoundOffAria')}
          className="flex items-center gap-1.5 rounded-full border border-white/40 bg-white/70 px-4 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm backdrop-blur-md transition hover:bg-white/95"
          onClick={handleToggleMute}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            {isMuted ? (
              <>
                <path d="m16 9 5 5" />
                <path d="m21 9-5 5" />
              </>
            ) : (
              <>
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </>
            )}
          </svg>
          {isMuted ? t('thankYouVideoSoundOn') : t('thankYouVideoSoundOff')}
        </button>
        <button
          aria-label={t('thankYouVideoSkipAria')}
          className="rounded-full border border-white/40 bg-white/70 px-4 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm backdrop-blur-md transition hover:bg-white/95"
          onClick={handleSkip}
          type="button"
        >
          {t('thankYouVideoSkip')}
        </button>
      </div>

      {/* Panel 1 (0:00 - 0:01): "Hea, et oled siin." */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center justify-center px-6 text-center transition-all duration-500 ease-out ${
          showStep1 ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <h2 className="font-font_quote text-3xl font-normal leading-tight text-[#1E3A5F] sm:text-5xl md:text-6xl">
          {t('thankYouVideoStep1Title')}
        </h2>
        <div className="mx-auto my-3 h-[1.5px] w-12 bg-[#1E3A5F]/40" />
      </div>

      {/* Panel 4 (0:03 - 0:05): Heart + "Aitäh Sinu annetuse eest. Jumal õnnistagu Sind. 🙏" */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center justify-center px-6 text-center transition-all duration-500 ease-out ${
          showStep4 ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        {/* Gold outlined heart */}
        <div className="mb-4">
          <svg
            className="h-10 w-10 text-[#C5A059] sm:h-12 sm:w-12"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
            viewBox="0 0 24 24"
          >
            <path d="M19.5 13.572 12 21l-7.5-7.428A5 5 0 1 1 12 7.006a5 5 0 1 1 7.5 6.572Z" />
          </svg>
        </div>

        <h2 className="font-font_quote text-2xl font-normal leading-snug text-[#1E3A5F] sm:text-4xl md:text-5xl">
          {t('thankYouVideoStep4Title')}
          <br />
          {t('thankYouVideoStep4Blessing')}
        </h2>

        <div className="mx-auto my-3.5 h-[1.5px] w-12 bg-[#1E3A5F]/40" />

        <p className="font-font_text text-sm font-normal text-[#475569] sm:text-base md:text-lg">
          {t('thankYouVideoStep4Subtitle')}
        </p>
      </div>

      {/* Panel 5 (0:05 - 0:06): App icon + "Prayer 365" + "PALVETA · KUULU · ANNETA · KASVA" */}
      <div
        className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center justify-center px-6 text-center transition-all duration-500 ease-out ${
          showStep5 ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="relative mb-3 h-20 w-20 overflow-hidden rounded-2xl shadow-lg sm:h-24 sm:w-24">
          <Image
            alt="Prayer 365"
            className="object-contain"
            fill
            priority
            sizes="(max-width: 640px) 80px, 96px"
            src="/images/logo.png"
          />
        </div>

        <h2 className="font-font_heading text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl md:text-5xl">
          Prayer <span className="text-[#0070F3]">365</span>
        </h2>

        <p className="mt-3 font-font_heading text-[11px] font-semibold tracking-[0.25em] text-[#1E293B] sm:text-xs md:text-sm">
          {t('thankYouVideoStep5Pillars')}
        </p>
      </div>

      {/* Panel 6 (0:06 - 0:07+): "Iga päev palves. Iga päev koos." + bottom mission line */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 transition-all duration-500 ease-out sm:p-12 md:p-16 ${
          showStep6 ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {/* Main text positioned left/center to leave the cross on the right visible */}
        <div className="my-auto flex flex-col items-center text-center sm:items-start sm:pl-10 sm:text-left md:pl-20">
          <h2 className="font-font_quote text-3xl font-normal leading-tight text-[#1E3A5F] sm:text-4xl md:text-5xl lg:text-6xl">
            {t('thankYouVideoStep6Line1')}
            <br />
            {t('thankYouVideoStep6Line2')}
          </h2>
          <div className="my-3 h-[1.5px] w-12 bg-[#1E3A5F]/40" />
        </div>

        {/* Bottom banner matching Image #1 */}
        <p className="w-full text-center font-font_heading text-[10px] font-semibold tracking-[0.25em] text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)] sm:text-xs md:text-sm">
          {t('thankYouVideoStep6Footer')}
        </p>
      </div>
    </div>
  )
}
