import { sleep } from '../church-directory-import/enrich'

export const USER_AGENT =
  'Prayer365DirectoryBot/1.0 (+https://prayer365.eu; church directory import)'

export interface Coordinates {
  lat: number
  lng: number
  source: string
}

export interface CoordinatesInput {
  churchName: string
  address: string | null
  override?: { lat?: number | null; lng?: number | null; source?: string } | null
  uniquePlace?: boolean
}

export const getJson = async <T>(url: string): Promise<T | null> => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) return null
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

/** "AEGVIIDU Aleksandri kogudus" -> "AEGVIIDU"; the article is named after the place. */
export const placeToken = (churchName: string): string =>
  (churchName.split(/\s+/)[0] ?? '').replace(/[^A-Za-zÕÄÖÜŠŽõäöüšž]/g, '')

interface WikiSearch {
  query?: { search?: { title: string }[] }
}

interface WikiPages {
  query?: { pages?: Record<string, { coordinates?: { lat: number; lon: number }[] }> }
}

const NAME_STOPWORDS = new Set(['kogudus', 'püha', 'kirik', 'toomkirik', 'ning', 'ja'])

/** First words that are languages or peoples, not places: those always need the church word. */
const NON_PLACE_TOKENS = new Set(['soome', 'rootsi', 'vene', 'saksa', 'inglise', 'eesti', 'läti'])

/** "TARTU Peetri kogudus" -> ["tartu", "peetri"]; the second word tells the churches apart. */
export const nameTokens = (churchName: string): string[] =>
  churchName
    .toLocaleLowerCase('et')
    .replace(/[.,()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !NAME_STOPWORDS.has(word))

const searchTitles = async (term: string): Promise<string[]> => {
  const search = await getJson<WikiSearch>(
    `https://et.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=8&srsearch=${encodeURIComponent(term)}`,
  )
  await sleep(250)
  return (search?.query?.search ?? []).map((hit) => hit.title)
}

/**
 * Accepts an article only when its title names BOTH the place and the church word
 * ("TARTU Peetri" must not land on "Tartu Maarja kirik"). A near miss falls through to
 * Nominatim, because a wrong pin is worse than no pin.
 *
 * `uniquePlace` says only one congregation in the directory sits in this place, so the
 * place-named church article is unambiguous ("Aegviidu Aleksandri" -> "Aegviidu kirik").
 */
export const wikiCoordinates = async (
  churchName: string,
  { uniquePlace = false }: { uniquePlace?: boolean } = {},
): Promise<Coordinates | null> => {
  const tokens = nameTokens(churchName)
  if (tokens.length === 0) return null
  const place = tokens[0]
  const distinctive = tokens.slice(1)
  const requireDistinctive = !uniquePlace || NON_PLACE_TOKENS.has(place)
  const titles = [
    ...(await searchTitles(`${place} kirik`)),
    ...(await searchTitles(`${tokens.join(' ')} kirik`)),
  ]
  const title = titles.find((candidate) => {
    const lower = candidate.toLocaleLowerCase('et')
    if (!lower.includes(place)) return false
    if (!/kirik|toomkirik|kabel/i.test(candidate)) return false
    if (!requireDistinctive) return true
    // One matching church word is enough: "Tallinna Toompea Kaarli" -> "Tallinna Kaarli kirik".
    return distinctive.length === 0 || distinctive.some((word) => lower.includes(word))
  })
  if (!title) return null
  const page = await getJson<WikiPages>(
    `https://et.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&redirects=1&titles=${encodeURIComponent(title)}`,
  )
  await sleep(250)
  const coordinates = Object.values(page?.query?.pages ?? {})[0]?.coordinates?.[0]
  if (!coordinates) return null
  return {
    lat: Number(coordinates.lat.toFixed(6)),
    lng: Number(coordinates.lon.toFixed(6)),
    source: `et.wikipedia:${title}`,
  }
}

/** Nominatim allows one request per second; the delay is part of the contract, not an optimisation. */
export const nominatimCoordinates = async (address: string | null): Promise<Coordinates | null> => {
  if (!address || address.trim().length < 6) return null
  const query = async (term: string) => {
    await sleep(1100)
    const hits = await getJson<{ lat: string; lon: string; display_name: string }[]>(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(term.trim())}`,
    )
    const first = hits?.[0]
    if (!first) return null
    return {
      lat: Number(Number(first.lat).toFixed(6)),
      lng: Number(Number(first.lon).toFixed(6)),
      source: `nominatim:${first.display_name.slice(0, 80)}`,
    }
  }
  const direct = await query(address)
  if (direct) return direct
  // A postal code can defeat the matcher; try the same street without it.
  const withoutPostcode = address
    .replace(/\s*\b\d{5}\b\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (withoutPostcode === address.trim()) return null
  return query(withoutPostcode)
}

export const findCoordinates = async ({
  churchName,
  address,
  override,
  uniquePlace = false,
}: CoordinatesInput): Promise<Coordinates | null> => {
  if (typeof override?.lat === 'number' && typeof override?.lng === 'number') {
    return { lat: override.lat, lng: override.lng, source: override.source ?? 'override:manual' }
  }
  const wiki = await wikiCoordinates(churchName, { uniquePlace })
  if (wiki) return wiki
  return nominatimCoordinates(address)
}
