// Static W10 side content that follows the design until a liturgical calendar / community source exists.
export const PRAYER_DETAIL_STATIC = {
  parishionersToday: 248,
  season: 'Ordinary Time (Green)',
  translation: 'NRSV / Piibel 1997',
  musicTitle: '1867 Walcker Organ, Op. 34',
  musicNote: 'Arvo Pärt – Spiegel im Spiegel arrangement',
  // ponytail: design number — must be confirmed as the real crisis line before launch.
  crisisPhone: '+372 644 1483',
}

/** Prayer body paragraphs: blank lines separate paragraphs, single newlines stay as line breaks. */
export const paragraphs = (body: string) =>
  body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
