'use client'

import AudioPlayer, { AudioPlayerLabels } from '@/components/site/prayer/audio-player'
import { useSiteI18n } from '@/i18n/site-i18n'

/**
 * The playable audio of the platform daily prayer, shared by the reader page, the
 * home hero and the public landing page so the control and its labels cannot
 * diverge. Renders nothing until the prayer has a generated asset (`src === null`),
 * which is the normal state for a QUEUED/FAILED row.
 */
export default function GeneralPrayerAudio({
  src,
  seed,
}: {
  /** Public S3 URL from the provider (`audioUrl`); null = text-only prayer. */
  src: string | null
  /** Stable identifier seeding the decorative wave so SSR and hydration match. */
  seed: string
}) {
  const { t } = useSiteI18n()
  if (!src) return null

  const labels: AudioPlayerLabels = {
    play: t('generalPrayerAudioPlay'),
    pause: t('generalPrayerAudioPause'),
    back10: t('generalPrayerAudioBack10'),
    forward10: t('generalPrayerAudioForward10'),
    rate: (rate) => t('generalPrayerAudioRate', { rate }),
    mute: t('generalPrayerAudioMute'),
    unmute: t('generalPrayerAudioUnmute'),
    download: t('generalPrayerAudioDownload'),
  }

  return <AudioPlayer labels={labels} seed={seed} src={src} />
}
