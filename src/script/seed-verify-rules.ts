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
