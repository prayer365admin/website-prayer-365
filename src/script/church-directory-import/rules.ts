/*
 * Pure mapping layer for the Estonian church directory import: CSV row -> the
 * values the importer writes. No database, no network, so it is unit-testable.
 */

export type CsvRow = Record<string, string>

/** Settlement per CSV row. The PDF address has no city column; these were read off the addresses. */
export const CITY_BY_ORDER: Record<string, string> = {
  '1': 'Haabneeme',
  '2': 'Tallinn',
  '3': 'Kinksi küla',
  '4': 'Viljandi',
  '5': 'Märjamaa',
  '6': 'Pärnu',
  '7': 'Tallinn',
  '8': 'Tartu',
  '9': 'Tallinn',
  '10': 'Narva',
  '11': 'Tartu',
  '12': 'Võnnu',
  '13': 'Tallinn',
  '14': 'Tallinn',
  '15': 'Rapla',
  '16': 'Viljandi',
  '17': 'Kambja',
  '18': 'Tartu',
  '19': 'Halliste',
  '20': 'Haapsalu',
  '21': 'Kaarma-Kirikuküla',
  '22': 'Tartu',
  '23': 'Haljala',
  '24': 'Kihelkonna',
  '25': 'Peetri',
}

/** CSV name (normalised) -> PROD slug, for a church that exists under a different name. */
export const EXISTING_SLUG_BY_CSV_NAME: Record<string, string> = {
  'tallinn kaarli church': 'kaarli-kirik-st-charless-church',
}

/**
 * Rows where the congregation and the building are not the same place. Row 20 lists
 * Haapsalu Cathedral (the castle church), while its congregation is Haapsalu St John's
 * — searching the congregation name returns the wrong building's article.
 */
export const WIKI_TERM_BY_ORDER: Record<string, string> = {
  '20': 'Haapsalu toomkirik',
}

export type Coordinates = Record<string, { lat?: number | null; lng?: number | null }>

export interface ImagePlan {
  url: string
  sourceUrl: string
  credit: string
  license: string
  note: string
  urlStatus: string
}

export interface PastorAssignment {
  order: string
  churchName: string
  role: string
}

export interface PastorPlan {
  name: string
  email: string
  assignments: PastorAssignment[]
  image: ImagePlan
}

export interface ChurchSidecar {
  buildingFootprintM2: number | null
  sizeRank: number | null
  parishOfficeAddress: string | null
  venueNote: string | null
  parishUrl: string | null
  directoryUrl: string | null
  buildingMapUrl: string | null
  voiceReferenceUrl: string | null
  prayerReferenceUrl: string | null
  voiceReferenceDescription: string
  prayerReferenceDescription: string
  prayerTextStatus: string
  sourcePdfPage: string
  sourceDocumentDate: string
}

export interface ChurchPlan {
  order: string
  name: string
  normalisedName: string
  existingSlug: string | null
  timezone: string
  denomination: string
  address: { line1: string; city: string }
  contacts: { email?: string }
  website: string | null
  latitude: number | null
  longitude: number | null
  languages: string[]
  sortOrder: number
  churchImage: ImagePlan
  sidecar: ChurchSidecar
}

/**
 * Name key for matching a CSV row to a PROD church. The two sources disagree on
 * small things — curly vs straight apostrophes, "St." vs "St" — and every
 * difference would create a duplicate church instead of updating the real one.
 */
export const normaliseName = (value: string): string =>
  value
    .replace(/[\u2018\u2019\u02bc`´]/g, "'")
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export const parseRows = (raw: CsvRow[]): CsvRow[] =>
  raw.filter((row) => (row.church_name ?? '').trim().length > 0)

export const cityFor = (order: string): string => {
  const city = CITY_BY_ORDER[order]
  if (!city) throw new Error(`no city mapping for CSV row ${order}`)
  return city
}

export const aliasSlugFor = (name: string): string | null =>
  EXISTING_SLUG_BY_CSV_NAME[normaliseName(name)] ?? null

const imageFrom = (row: CsvRow, prefix: 'church' | 'pastor'): ImagePlan => ({
  url: row[`${prefix}_image_url`],
  sourceUrl: row[`${prefix}_image_source_url`],
  credit: row[`${prefix}_image_credit`],
  license: row[`${prefix}_image_license`],
  note: row[`${prefix}_image_note`],
  urlStatus: row[`${prefix}_image_url_status`],
})

export const buildChurchPlans = (rows: CsvRow[], coords: Coordinates): ChurchPlan[] =>
  rows.map((row) => {
    const order = row.directory_order
    const coord = coords[order]
    const lat = typeof coord?.lat === 'number' ? coord.lat : null
    const lng = typeof coord?.lng === 'number' ? coord.lng : null
    return {
      order,
      name: row.church_name,
      normalisedName: normaliseName(row.church_name),
      existingSlug: aliasSlugFor(row.church_name),
      timezone: row.timezone,
      denomination: row.denomination,
      address: { line1: row.church_address, city: cityFor(order) },
      contacts: row.church_email ? { email: row.church_email } : {},
      website: row.parish_url.trim() || null,
      latitude: lat !== null && lng !== null ? lat : null,
      longitude: lat !== null && lng !== null ? lng : null,
      languages: ['et'],
      sortOrder: Number(order),
      churchImage: imageFrom(row, 'church'),
      sidecar: {
        buildingFootprintM2: row.building_footprint_m2 ? Number(row.building_footprint_m2) : null,
        sizeRank: row.size_rank ? Number(row.size_rank) : null,
        parishOfficeAddress: row.parish_office_address || null,
        venueNote: row.venue_note || null,
        parishUrl: row.parish_url || null,
        directoryUrl: row.directory_url || null,
        buildingMapUrl: row.building_map_url || null,
        voiceReferenceUrl: row.voice_reference_url || null,
        prayerReferenceUrl: row.prayer_reference_url || null,
        voiceReferenceDescription: row.voice_reference_description,
        prayerReferenceDescription: row.prayer_reference_description,
        prayerTextStatus: row.prayer_text_status,
        sourcePdfPage: row.source_pdf_page,
        sourceDocumentDate: row.source_document_date,
      },
    }
  })

/**
 * One PastorPlan per pastor email; a pastor serving two churches keeps both
 * assignments (Jaak Aus, Urmas Karileet).
 */
export const groupPastors = (rows: CsvRow[]): PastorPlan[] => {
  const byEmail = new Map<string, PastorPlan>()
  for (const row of rows) {
    const email = row.pastor_email.trim().toLowerCase()
    if (!email) throw new Error(`CSV row ${row.directory_order} has no pastor_email`)
    const existing = byEmail.get(email)
    const assignment: PastorAssignment = {
      order: row.directory_order,
      churchName: row.church_name,
      role: row.pastor_role,
    }
    if (existing) {
      existing.assignments.push(assignment)
      continue
    }
    byEmail.set(email, {
      name: row.pastor_name,
      email,
      assignments: [assignment],
      image: imageFrom(row, 'pastor'),
    })
  }
  return Array.from(byEmail.values())
}
