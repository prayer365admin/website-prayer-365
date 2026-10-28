import AudioWavePlayer from '@/components/common/audio-wave-player'
import { useMediaAccess } from '@/hooks/data/media-access'
import { Skeleton } from 'antd'

/** "1:42" from seconds. */
export const formatDuration = (seconds: number) => {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Private sample/evidence playback through a short-lived access URL.
 * Reports the audio length so the parent can show the combined duration.
 */
export default function SamplePlayer({
  churchId,
  assetId,
  label,
  onDuration,
}: {
  churchId: string
  assetId: string
  label: string
  onDuration?: (assetId: string, seconds: number) => void
}) {
  const { data, loading } = useMediaAccess(churchId, assetId)
  if (loading) return <Skeleton.Input active size="small" />
  if (!data?.url) return <span className="text-gray-500">Preview unavailable</span>
  return (
    <AudioWavePlayer
      label={label}
      seed={assetId}
      src={data.url}
      onDuration={(seconds) => onDuration?.(assetId, seconds)}
    />
  )
}
