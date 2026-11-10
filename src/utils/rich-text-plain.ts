import { stripAudioTags } from './strip-audio-tags'

const decodeEntity = (entity: string) => {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }
  if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
  if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
  return named[entity] ?? `&${entity};`
}

const ENTITY_PATTERN = /&(#x[\da-f]+|#\d+|[a-z]+);/gi
const decodeEntityOnce = (value: string) =>
  value.replace(ENTITY_PATTERN, (_, entity: string) => decodeEntity(entity.toLowerCase()))

/**
 * Editors and CSV imports double-escape entities (`&amp;nbsp;`), which one pass
 * leaves as the literal text `&nbsp;` — a run of non-breaking pseudo-spaces that
 * cannot wrap and breaks the card layout. Decode until stable (max 3 passes).
 */
const decodeEntities = (value: string) => {
  let current = value
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeEntityOnce(current)
    if (next === current) break
    current = next
  }
  return current
}

/** Converts stored prayer HTML (and legacy plain text) into narration/summary text. */
export const richTextToPlainText = (value: string) =>
  decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/\s*(?:p|div|h[1-6]|blockquote|li)>/gi, '\n')
      .replace(/<li(?:\s[^>]*)?>/gi, '• ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/** Returns one complete sentence from prayer HTML without adding truncation marks. */
export const richTextFirstSentence = (value: string) => {
  const text = richTextToPlainText(value).replace(/\s+/g, ' ').trim()
  return text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text
}

/** Reader-safe one-line text for prayer titles, previews, quotes, and accessible labels. */
export const prayerTextForDisplay = (value: string) =>
  stripAudioTags(richTextToPlainText(value)).replace(/\s+/g, ' ').trim()

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Turns an uploaded plain-text prayer into the editor's safe paragraph markup. */
export const plainTextToRichText = (value: string) =>
  value
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
