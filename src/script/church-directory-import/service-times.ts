/*
 * Parses the EELK directory's "Jumalateenistus …" sentence into service_times
 * rows. A clause that states a time but no weekday (and has no weekday carried
 * from the previous clause) is reported as flagged — the importer never guesses
 * a weekday.
 */

export interface ParsedServiceTime {
  weekday: number
  time: string
  label: string
  language: string
}

export interface ServiceTimeParse {
  times: ParsedServiceTime[]
  flagged: string[]
}

const WEEKDAYS: [RegExp, number][] = [
  [/esmaspäev/i, 1],
  [/teisipäev/i, 2],
  [/kolmapäev/i, 3],
  [/neljapäev/i, 4],
  [/reede/i, 5],
  [/laupäev/i, 6],
  [/pühapäev/i, 7],
]

const LANGUAGES: [RegExp, string][] = [
  [/rootsi/i, 'sv'],
  [/soome/i, 'fi'],
  [/saksa/i, 'de'],
  [/vene/i, 'ru'],
  [/inglise/i, 'en'],
]

const TIME = /(\d{1,2})[.:](\d{2})/
const MONTHLY_WITHOUT_DAY = /kord kuus/i

export const parseServiceSentence = (sentence: string): ServiceTimeParse => {
  const body = sentence
    .replace(/^Jumalateenistus(?:ed)?\s*/i, '')
    .split(/Koguduse arvelduskonto/i)[0]
    .replace(/\s+/g, ' ')
    .trim()

  const times: ParsedServiceTime[] = []
  const flagged: string[] = []
  let carried = 0

  for (const rawClause of body.split(/,\s*/)) {
    const clause = rawClause.trim()
    if (!clause) continue

    const dayHits = WEEKDAYS.filter(([pattern]) => pattern.test(clause)).map(([, day]) => day)
    const timeMatch = clause.match(TIME)

    // "esmaspäeviti, teisipäeviti, kolmapäeviti 7.30" — the time belongs to the list.
    if (dayHits.length > 0 && !timeMatch) {
      carried = dayHits[0]
      continue
    }
    if (!timeMatch) continue

    if (dayHits.length === 0 && (carried === 0 || MONTHLY_WITHOUT_DAY.test(clause))) {
      flagged.push(clause)
      continue
    }

    const weekday = dayHits[0] ?? carried
    const time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
    const language = LANGUAGES.find(([pattern]) => pattern.test(clause))?.[1] ?? 'et'
    times.push({ weekday, time, label: clause, language })
    carried = dayHits[0] ?? carried
  }

  return { times, flagged }
}
