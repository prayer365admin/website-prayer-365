'use client'

import { DownloadIcon } from '@/components/icon/download'
import { FastForwardIcon } from '@/components/icon/fast-forward'
import { PauseIcon } from '@/components/icon/pause'
import { PlayIcon } from '@/components/icon/play'
import { useEffect, useRef, useState } from 'react'
import styles from './index.module.scss'

const BAR_COUNT = 96

const createWave = (seed: string) => {
  let state = seed
    .split('')
    .reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), 2166136261)

  return Array.from({ length: BAR_COUNT }, () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507) + 0x6d2b79f5
    return 5 + (((state >>> 0) % 1000) / 1000) * 35
  })
}

export const formatAudioTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const rounded = Math.max(0, Math.floor(seconds))
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

/** Reusable compact waveform control for protected voice samples and other dashboard audio. */
export default function AudioWavePlayer({
  label,
  seed,
  src,
  onDuration,
}: {
  label: string
  seed: string
  src: string
  onDuration?: (seconds: number) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [wave] = useState(() => createWave(seed))
  const progress = duration > 0 ? Math.min(current / duration, 1) : 0

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const update = () => {
      if (audioRef.current) setCurrent(audioRef.current.currentTime)
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const syncDuration = () => {
    const nextDuration = audioRef.current?.duration
    if (!nextDuration || !Number.isFinite(nextDuration)) return
    setDuration(nextDuration)
    onDuration?.(nextDuration)
  }

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || failed) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setPlaying(false)
      }
      return
    }
    audio.pause()
  }

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    const next = Math.max(0, Math.min(duration, seconds))
    audio.currentTime = next
    setCurrent(next)
  }

  const cycleRate = () => {
    const next = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  return (
    <div className={styles.player}>
      <audio
        onDurationChange={syncDuration}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setFailed(true)
          setPlaying(false)
        }}
        onLoadedMetadata={syncDuration}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        preload="metadata"
        ref={audioRef}
        src={src}
      />

      <div className={styles.label}>{label}</div>
      <div className={styles.waveArea}>
        <div aria-hidden="true" className={styles.wave}>
          {wave.map((height, index) => (
            <span
              className={
                (index + 1) / wave.length <= progress ? styles.playedBar : styles.remainingBar
              }
              key={`${height}-${index}`}
              style={{ height }}
            />
          ))}
        </div>
        <input
          aria-label={`${label} audio position`}
          className={styles.seek}
          disabled={!duration || failed}
          max={duration}
          min={0}
          onChange={(event) => seek(Number(event.target.value))}
          step={0.1}
          type="range"
          value={Math.min(current, duration)}
        />
      </div>

      <div className={styles.controls}>
        <button
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          className={styles.playButton}
          disabled={failed}
          onClick={togglePlayback}
          type="button"
        >
          {playing ? (
            <PauseIcon aria-hidden style={{ color: '#fff', fontSize: 20 }} />
          ) : (
            <PlayIcon aria-hidden style={{ color: '#fff', fontSize: 20 }} />
          )}
        </button>
        <span className={styles.time}>
          {formatAudioTime(current)} / {formatAudioTime(duration)}
        </span>
        <button
          aria-label={`${label} playback speed ${rate} times`}
          className={styles.rateButton}
          disabled={failed}
          onClick={cycleRate}
          type="button"
        >
          <FastForwardIcon aria-hidden style={{ fontSize: 12 }} />
          {rate}X
        </button>
        <a aria-label={`Download ${label}`} className={styles.downloadButton} download href={src}>
          <DownloadIcon aria-hidden style={{ fontSize: 20 }} />
        </a>
      </div>
      {failed && <span className={styles.error}>Preview unavailable</span>}
    </div>
  )
}
