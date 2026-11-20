import {
  parseServiceSentence,
  type ParsedServiceTime,
} from '../church-directory-import/service-times'
import type { Coordinates } from './enrich'
import type { EelkRow } from './parse'
import type { Photo } from './photos'
import {
  contactsFor,
  deaneryNodeName,
  EXISTING_SLUG_BY_REG_CODE,
  splitAddress,
  titleCaseName,
} from './rules'

export const DENOMINATION = 'Estonian Evangelical Lutheran Church (EELK)'
export const TIMEZONE = 'Europe/Tallinn'

export interface EnrichmentEntry {
  coordinates: Coordinates | null
  photos: Photo[]
}

export interface SeedChurch {
  order: number
  regCode: string
  name: string
  deanery: string
  deaneryNode: string
  timezone: string
  denomination: string
  address: { line1: string; city: string; postalCode: string | null; county: string | null }
  contacts: { email?: string; phone?: string }
  website: string | null
  socialLinks: { url: string; label: string }[]
  serviceSentence: string
  serviceTimes: ParsedServiceTime[]
  flaggedServiceClauses: string[]
  languages: string[]
  existingSlug: string | null
  coordinates: Coordinates | null
  photos: Photo[]
}

export interface SeedFile {
  generatedAt: string
  source: string
  churches: SeedChurch[]
}

export const buildSeedChurches = (
  rows: EelkRow[],
  enrichment: Record<string, EnrichmentEntry>,
): SeedChurch[] =>
  rows.map((row) => {
    const buildingAddress = row.churchAddressLine
      ? row.churchAddressLine.replace(/^kiriku aadress:\s*/i, '').trim()
      : ''
    const mainAddress = splitAddress(row.addressLine ?? '')
    // A building line is often just a street ("Mäe 3"): the settlement comes from the main address.
    const building = buildingAddress ? splitAddress(buildingAddress) : null
    const address =
      building && building.line1
        ? {
            line1: building.line1,
            city:
              building.city && building.city !== building.line1 ? building.city : mainAddress.city,
            postalCode: building.postalCode ?? mainAddress.postalCode,
            county: building.county ?? mainAddress.county,
          }
        : mainAddress
    const parsed = parseServiceSentence(row.serviceSentence)
    return {
      order: row.order,
      regCode: row.regCode,
      name: titleCaseName(row.name),
      deanery: row.deanery,
      deaneryNode: deaneryNodeName(row.deanery),
      timezone: TIMEZONE,
      denomination: DENOMINATION,
      address,
      contacts: contactsFor(row),
      website: row.website,
      socialLinks: row.socialLinks,
      serviceSentence: row.serviceSentence,
      serviceTimes: parsed.times,
      flaggedServiceClauses: parsed.flagged,
      languages: ['et'],
      existingSlug: EXISTING_SLUG_BY_REG_CODE[row.regCode] ?? null,
      coordinates: enrichment[row.regCode]?.coordinates ?? null,
      photos: enrichment[row.regCode]?.photos ?? [],
    }
  })
