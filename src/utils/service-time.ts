const DAY_MAP: Record<string, string> = {
  sunday: 'Sun',
  sun: 'Sun',
  pühapäev: 'Sun',
  söndag: 'Sun',
  sunnuntai: 'Sun',
  monday: 'Mon',
  mon: 'Mon',
  esmaspäev: 'Mon',
  måndag: 'Mon',
  maanantai: 'Mon',
  tuesday: 'Tue',
  tue: 'Tue',
  teisipäev: 'Tue',
  tisdag: 'Tue',
  tiistai: 'Tue',
  wednesday: 'Wed',
  wed: 'Wed',
  kolmapäev: 'Wed',
  onsdag: 'Wed',
  keskiviikko: 'Wed',
  thursday: 'Thu',
  thu: 'Thu',
  neljapäev: 'Thu',
  torsdag: 'Thu',
  torstai: 'Thu',
  friday: 'Fri',
  fri: 'Fri',
  reede: 'Fri',
  fredag: 'Fri',
  perjantai: 'Fri',
  saturday: 'Sat',
  sat: 'Sat',
  laupäev: 'Sat',
  lördag: 'Sat',
  lauantai: 'Sat',
}

/**
 * Formats a raw service times string to compact Day + Hour format (e.g. "Sun 10:00 AM • Sun 5:00 PM").
 */
export function formatServiceTime(raw?: string | null): string {
  if (!raw) return ''

  const segments = raw
    .split(' • ')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!segments.length) return ''

  let lastDay = 'Sun'

  const formattedSegments = segments.map((seg) => {
    let foundDay: string | null = null
    for (const [key, abbr] of Object.entries(DAY_MAP)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i')
      if (regex.test(seg)) {
        foundDay = abbr
        lastDay = abbr
        break
      }
    }
    const day = foundDay ?? lastDay

    const timeMatch = seg.match(/\b(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i)
    if (!timeMatch) return seg

    const hours = parseInt(timeMatch[1], 10)
    const minutes = timeMatch[2]
    const explicitAmPm = timeMatch[3]?.toUpperCase()

    let ampm: string
    let hour12: number

    if (explicitAmPm) {
      ampm = explicitAmPm
      hour12 = hours
    } else {
      ampm = hours >= 12 ? 'PM' : 'AM'
      hour12 = hours % 12 || 12
    }

    return `${day} ${hour12}:${minutes} ${ampm}`
  })

  return formattedSegments.join(' • ')
}
