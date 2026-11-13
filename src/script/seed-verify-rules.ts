/*
 * Pure demo-readiness rules — no database, no S3, no side effects, so they can be
 * unit tested and reused by any gate. Every rule corresponds to something a demo
 * visitor would notice as missing.
 */

export interface ChurchReadiness {
  name: string
  coverUrl: string | null
  galleryUrls: (string | null)[]
  serviceTimes: number
  events: number
  announcements: number
  pastors: number
}

export interface PrayerReadiness {
  church: string
  title: string
  published: boolean
  audioStatus: string | null
  audioUrl: string | null
}

export interface DemoExpectation {
  name: string
  prayerTitles: string[]
  galleryCount: number
}

export interface DemoReadiness {
  churches: ChurchReadiness[]
  prayers: PrayerReadiness[]
  expectations: DemoExpectation[]
  /** object key -> exists in the active bucket (empty map = check skipped) */
  objectStatus: Record<string, boolean>
}

export const findDemoProblems = (readiness: DemoReadiness): string[] => {
  const problems: string[] = []
  const byName = new Map(readiness.churches.map((c) => [c.name, c]))

  for (const expected of readiness.expectations) {
    const church = byName.get(expected.name)
    if (!church) {
      problems.push(`church missing from the database: ${expected.name}`)
      continue
    }
    if (!church.coverUrl) problems.push(`${expected.name}: no cover image`)
    if (church.galleryUrls.length < expected.galleryCount) {
      problems.push(
        `${expected.name}: gallery has ${church.galleryUrls.length}/${expected.galleryCount} images`,
      )
    }
    if (church.galleryUrls.some((url) => !url)) {
      problems.push(`${expected.name}: a gallery item has no image URL`)
    }
    if (church.serviceTimes === 0) problems.push(`${expected.name}: no service times`)
    if (church.pastors === 0) problems.push(`${expected.name}: no pastoral staff`)

    for (const title of expected.prayerTitles) {
      const prayer = readiness.prayers.find((p) => p.church === expected.name && p.title === title)
      if (!prayer) {
        problems.push(`${expected.name} / ${title}: prayer missing from the database`)
        continue
      }
      if (!prayer.published) problems.push(`${expected.name} / ${title}: not published`)
      if (prayer.audioStatus !== 'APPROVED') {
        problems.push(`${expected.name} / ${title}: audio status ${prayer.audioStatus ?? 'NONE'}`)
      }
      if (!prayer.audioUrl) {
        problems.push(`${expected.name} / ${title}: no audio URL`)
      } else if (!/^https?:\/\//.test(prayer.audioUrl)) {
        // The mobile app plays the served URL verbatim, so a relative path is
        // "no audio" there even though the website can serve it.
        problems.push(`${expected.name} / ${title}: audio URL is not absolute (${prayer.audioUrl})`)
      }
    }
  }

  for (const [key, exists] of Object.entries(readiness.objectStatus)) {
    if (!exists) problems.push(`media object missing in the bucket: ${key}`)
  }

  return problems
}

/** One seeded general prayer, as the gate reads it back. */
export interface GeneralPrayerReadiness {
  sequence: number
  slug: string
  bodyLength: number
  languageCode: string
  audioStatus: string
  isActive: boolean
}

const EXPECTED_GENERAL_PRAYER_COUNT = 10
const KNOWN_AUDIO_STATUSES = ['QUEUED', 'GENERATING', 'READY', 'FAILED']

/**
 * The cycle must be complete and continuous: the 10 delivered prayers at
 * positions 1–10, each with real text and Estonian content. A missing body is
 * a prayer the daily send would publish as an empty page (and speak as silence).
 */
export const findGeneralPrayerProblems = (rows: GeneralPrayerReadiness[]): string[] => {
  const problems: string[] = []
  if (rows.length !== EXPECTED_GENERAL_PRAYER_COUNT) {
    problems.push(`general prayers: ${rows.length}/${EXPECTED_GENERAL_PRAYER_COUNT} rows`)
  }

  const sequences = new Set<number>()
  for (const row of rows) {
    if (sequences.has(row.sequence)) {
      problems.push(`general prayer sequence ${row.sequence}: duplicated`)
    } else {
      sequences.add(row.sequence)
    }
    if (row.slug !== `paivapalve-${row.sequence}`) {
      problems.push(`general prayer ${row.sequence}: unexpected slug ${row.slug}`)
    }
    if (row.bodyLength === 0) problems.push(`general prayer ${row.sequence}: empty body`)
    if (row.languageCode.trim() !== 'et') {
      problems.push(`general prayer ${row.sequence}: language ${row.languageCode.trim()}`)
    }
    if (!KNOWN_AUDIO_STATUSES.includes(row.audioStatus)) {
      problems.push(`general prayer ${row.sequence}: audio status ${row.audioStatus}`)
    }
    if (!row.isActive) problems.push(`general prayer ${row.sequence}: inactive`)
  }

  for (let sequence = 1; sequence <= EXPECTED_GENERAL_PRAYER_COUNT; sequence += 1) {
    if (!sequences.has(sequence)) problems.push(`general prayer sequence ${sequence}: missing`)
  }

  return problems
}
