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
  onDuration,
}: {
  churchId: string
  assetId: string
  onDuration?: (assetId: string, seconds: number) => void
}) {
  const { data, loading } = useMediaAccess(churchId, assetId)
  if (loading) return <Skeleton.Input active size="small" />
  if (!data?.url) return <span className="text-gray-500">Preview unavailable</span>
  return (
    <audio
      controls
      preload="metadata"
      src={data.url}
      className="h-9 max-w-full"
      onLoadedMetadata={(e) => onDuration?.(assetId, e.currentTarget.duration)}
    />
  )
}
