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

/** Converts stored prayer HTML (and legacy plain text) into narration/summary text. */
export const richTextToPlainText = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(?:p|div|h[1-6]|blockquote|li)>/gi, '\n')
    .replace(/<li(?:\s[^>]*)?>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, entity: string) =>
      decodeEntity(entity.toLowerCase()),
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
