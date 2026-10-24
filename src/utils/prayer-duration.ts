import { richTextToPlainText } from './rich-text-plain'

const GENERATED_MP3_BITS_PER_SECOND = 128_000

/** Reading time for text-only prayers at a slow, reflective pace. */
export const readingMinutes = (text: string) =>
  Math.max(1, Math.round(richTextToPlainText(text).split(/\s+/).filter(Boolean).length / 150))

/**
 * Generated prayer audio uses ElevenLabs' fixed `mp3_44100_128` output.
 * The persisted asset byte size therefore gives its playback duration without
 * loading every MP3 during an archive request.
 */
export const generatedAudioDurationSeconds = (
  byteSize: bigint | number | null | undefined,
): number | null => {
  if (byteSize == null) return null
  const bytes = Number(byteSize)
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  return Math.max(1, Math.round((bytes * 8) / GENERATED_MP3_BITS_PER_SECOND))
}

/** Prefer real generated-audio duration; retain reading time for text-only/legacy records. */
export const prayerDurationMinutes = (text: string, durationSeconds?: number | null) =>
  durationSeconds && durationSeconds > 0
    ? Math.max(1, Math.ceil(durationSeconds / 60))
    : readingMinutes(text)
