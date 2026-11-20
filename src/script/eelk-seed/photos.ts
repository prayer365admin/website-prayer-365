import { sleep } from '../church-directory-import/enrich'
import { getJson, nameTokens } from './enrich'

export interface Photo {
  title: string
  url: string
  width: number
  license: string
  author: string
  caption: string
  sourceUrl: string
}

export interface CommonsPage {
  title: string
  imageinfo?: {
    url: string
    thumburl?: string
    width: number
    thumbwidth?: number
    mime?: string
    extmetadata?: Record<string, { value?: string }>
  }[]
}

interface CommonsResponse {
  query?: { pages?: Record<string, CommonsPage> }
}

const REJECT =
  /logo|kaart|map|vapp|coat of arms|plaan|diagram|portrait|sisemus|interior|altar|kalmistu|cemetery|monument|memorial|mälestus|hauakivi|grave/i

const plain = (value?: string): string =>
  (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** A file named after the church outranks a graveyard/street shot, then the wider file wins. */
const photoScore = (photo: Photo): number =>
  /kirik|church|toomkirik|kabel|cathedral/i.test(photo.title) ? 0 : 1

export const pickPhotos = (pages: CommonsPage[], limit = 6): Photo[] => {
  const photos: Photo[] = []
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    if (REJECT.test(page.title)) continue
    const mime = info.mime ?? (/\.png$/i.test(page.title) ? 'image/png' : 'image/jpeg')
    if (!/image\/(jpeg|png)/i.test(mime)) continue
    if (info.width < 800) continue
    const license = plain(info.extmetadata?.LicenseShortName?.value)
    if (!license) continue
    photos.push({
      title: page.title.replace(/^File:/, ''),
      url: info.thumburl ?? info.url,
      width: info.thumbwidth ?? info.width,
      license,
      author: plain(info.extmetadata?.Artist?.value) || 'Wikimedia Commons',
      caption:
        plain(info.extmetadata?.ImageDescription?.value).slice(0, 160) ||
        page.title.replace(/^File:/, '').replace(/\.(jpe?g|png)$/i, ''),
      sourceUrl: `https://commons.wikimedia.org/wiki/${page.title.replace(/ /g, '_')}`,
    })
  }
  return photos
    .sort((left, right) => photoScore(left) - photoScore(right) || right.width - left.width)
    .slice(0, limit)
}

export const commonsPhotos = async (
  churchName: string,
  { uniquePlace = false, limit = 6 }: { uniquePlace?: boolean; limit?: number } = {},
): Promise<Photo[]> => {
  const tokens = nameTokens(churchName)
  const place = tokens[0]
  if (!place || place.length < 3) return []
  const terms = Array.from(
    new Set([`${place} kirik`, tokens.length > 1 ? `${tokens.join(' ')} kirik` : '']),
  ).filter(Boolean)
  const pages = new Map<string, CommonsPage>()
  for (const term of terms) {
    const data = await getJson<CommonsResponse>(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
        `&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(term)}` +
        `&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280`,
    )
    await sleep(300)
    for (const [id, page] of Array.from(Object.entries(data?.query?.pages ?? {}))) {
      pages.set(id, page)
    }
    if (pages.size >= 12) break
  }
  // A file must name this place, and in a town with several congregations it must also name
  // this church: "Tartu kirik" alone had matched Tartu Jaani for Tartu Peetri.
  const placeLower = place.toLocaleLowerCase('et')
  const distinctive = tokens.slice(1)
  const relevant = Array.from(pages.values()).filter((page) => {
    const title = page.title.toLocaleLowerCase('et')
    if (!title.includes(placeLower)) return false
    if (uniquePlace || distinctive.length === 0) return true
    return distinctive.some((word) => title.includes(word))
  })
  return pickPhotos(relevant, limit)
}
