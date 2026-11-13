/**
 * Decorative waveform bars for audio players.
 *
 * These are NOT an amplitude analysis of the file: no audio is decoded, so the
 * bars cannot show where the voice rises or pauses. They are a deterministic
 * fingerprint of the content — the same seed always yields the same shape on the
 * server and on the client (so hydration matches), and a different seed yields a
 * visibly different shape (so each prayer looks like its own recording).
 *
 * One implementation on purpose: the dashboard control, the reader page and the
 * welcome card used to each roll their own (one of them a symmetric sine, which
 * read as a different kind of graphic on the same content). Callers keep their
 * own bar count and height range so each player still fits its card.
 */

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619
const XSHIFT_A = 2246822507
const XSHIFT_B = 0x6d2b79f5

/** Heights in px for `count` bars; `min`..`min + range`, seeded by `seed`. */
export const waveformBars = ({
  seed,
  count,
  min = 4,
  range = 42,
}: {
  seed: string
  count: number
  min?: number
  range?: number
}): number[] => {
  let state = seed
    .split('')
    .reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), FNV_PRIME), FNV_OFFSET)

  return Array.from({ length: count }, () => {
    state = Math.imul(state ^ (state >>> 15), XSHIFT_A) + XSHIFT_B
    return min + (((state >>> 0) % 1000) / 1000) * range
  })
}
