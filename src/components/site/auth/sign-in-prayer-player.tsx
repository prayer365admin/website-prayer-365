'use client'

import { CaretRightFilled } from '@/components/icon/antd-icons'
import { SoundWaveIcon } from '@/components/icon/sound-wave'
import { SiteLoginPrayer } from '@/models/site-prayer'
import { PauseOutlined } from '@ant-design/icons'
import { useRef, useState } from 'react'

export default function SignInPrayerPlayer({
  pauseLabel,
  playLabel,
  prayer,
}: {
  pauseLabel: string
  playLabel: string
  prayer: SiteLoginPrayer
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

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

  const actionLabel = playing ? pauseLabel : playLabel

  return (
    <div className="mt-4 flex items-center gap-[45px] rounded-xl bg-white/10 p-3">
      <audio
        onEnded={() => setPlaying(false)}
        onError={() => setPlaying(false)}
        preload="metadata"
        ref={audioRef}
        src={prayer.audioUrl}
      />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          aria-label={`${actionLabel}: ${prayer.title}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-white text-blue-800"
          onClick={togglePlayback}
          type="button"
        >
          {playing ? <PauseOutlined /> : <CaretRightFilled />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{prayer.title}</p>
          <p className="truncate text-xs text-white/80">
            {prayer.pastorName} • {prayer.churchName}
          </p>
        </div>
      </div>
      <span className="flex items-center gap-1 text-xs uppercase">
        <SoundWaveIcon aria-hidden className="!text-blue-100" style={{ fontSize: 15 }} />
        {prayer.languageCode}
      </span>
    </div>
  )
}
