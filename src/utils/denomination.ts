/**
 * Format church denomination for compact UI badges (e.g. church cards, map previews).
 * Extracts text inside parentheses when present (e.g. 'Lutheran (EELK)' => 'EELK').
 * Falls back to the trimmed original value if no parentheses are present.
 */
export function formatDenomination(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/\(([^)]+)\)/)
  return match ? match[1].trim() : trimmed
}
