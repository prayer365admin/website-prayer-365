/*
 * Enrichment sources for the church directory import. Nothing here touches the
 * database: it fetches official public pages and returns plain values, which the
 * importer stages in `.hermes/fixtures/church-directory/enriched.json`.
 *
 * Measured 2026-11-11 (plan 037 §1.7):
 *  - eelk.ee/inc.kogudused.php is a table, one <tr> per congregation (~370-540 chars)
 *    holding address, phone, email, website, facebook link and a "Jumalateenistus …"
 *    sentence. A ±700-char text window bleeds into neighbour rows — parse the row.
 *  - api.openstreetmap.org/api/0.6/way/<id>/full.json returns the building linked by
 *    the CSV building_map_url; the node centroid is the church position.
 */
import { JSDOM } from 'jsdom'

const USER_AGENT = 'Prayer365DirectoryBot/1.0 (+https://prayer365.eu; church directory import)'

export const EELK_DIRECTORY_URL = 'https://eelk.ee/inc.kogudused.php'

export interface SocialLink {
  url: string
  label: string
}

export interface Coordinates {
  lat: number
  lng: number
  source: string
}

export interface SourceText {
  text: string
  source: string
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchText = async (url: string): Promise<string> => {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP_${res.status} ${url}`)
  return res.text()
}

export const loadEelkDocument = async (): Promise<Document> => {
  const html = await fetchText(EELK_DIRECTORY_URL)
  return new JSDOM(html).window.document
}

/** The smallest element that holds this congregation's email, a service sentence and "kogudus". */
export const eelkRowFor = (doc: Document, email: string): Element | null => {
  const needle = email.trim().toLowerCase()
  const candidates = Array.from(doc.querySelectorAll('tr, li, div, p')).filter((element) => {
    const text = (element.textContent ?? '').toLowerCase()
    return text.includes(needle) && /kogudus/.test(text) && /jumalateenistus/.test(text)
  })
  return (
    candidates.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0] ??
    null
  )
}

const SOCIAL_HOST =
  /(?:https?:\/\/)?(?:www\.)?(facebook\.com|instagram\.com|youtube\.com|youtu\.be)/i
const NOT_A_PROFILE = /sharer|\/plugins\/|\/tr\?|intent\/tweet|share\.php|dialog\/feed/i

export const socialLinksFrom = (row: Element): SocialLink[] => {
  const links: SocialLink[] = []
  for (const anchor of Array.from(row.querySelectorAll('a[href]'))) {
    const href = (anchor.getAttribute('href') ?? '').trim()
    if (!SOCIAL_HOST.test(href) || NOT_A_PROFILE.test(href)) continue
    const absolute = href.startsWith('http') ? href : `https://${href.replace(/^\/\//, '')}`
    // Facebook and friends serve the same page over TLS; the public site is https.
    const url = absolute.replace(/^http:\/\//, 'https://')
    if (links.some((link) => link.url === url)) continue
    const label = /instagram/i.test(url) ? 'Instagram' : /youtu/i.test(url) ? 'YouTube' : 'Facebook'
    links.push({ url, label })
  }
  return links
}

/** The service sentence inside that congregation's row, without the bank-account tail. */
export const serviceSentenceFrom = (row: Element): string => {
  const text = (row.textContent ?? '').replace(/\s+/g, ' ')
  const match = text.match(/Jumalateenistus[^|]*?(?=Koguduse arvelduskonto|$)/i)
  return match ? match[0].trim() : ''
}

/**
 * Centroid of the OSM way nodes. The CSV links the building itself (way), not a
 * search box, so this is the church footprint centre.
 */
export const osmCentroid = async (mapUrl: string): Promise<Coordinates> => {
  const wayId = mapUrl.match(/\/way\/(\d+)/)?.[1]
  if (!wayId) throw new Error(`NO_OSM_WAY ${mapUrl}`)
  const body = await fetchText(`https://api.openstreetmap.org/api/0.6/way/${wayId}/full.json`)
  const data = JSON.parse(body) as {
    elements: { type: string; lat?: number; lon?: number }[]
  }
  const nodes = data.elements.filter((element) => element.type === 'node')
  if (nodes.length === 0) throw new Error(`OSM_NO_NODES way ${wayId}`)
  const lat = nodes.reduce((sum, node) => sum + (node.lat ?? 0), 0) / nodes.length
  const lng = nodes.reduce((sum, node) => sum + (node.lon ?? 0), 0) / nodes.length
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), source: `osm:way/${wayId}` }
}

const CHURCH_WORD = /kirik|kogudus|church|cathedral|chapel/i

/** The place name a search hit must mention, so a county/town article is not accepted as the church. */
const keyToken = (term: string): string => term.trim().split(/\s+/)[0] ?? ''

/**
 * et.wikipedia first, en.wikipedia second. A hit is only accepted when the extract
 * is about a church AND names the searched place — otherwise the search returns a
 * town ("Võnnu"), a county ("Rapla County") or a neighbouring church, and the
 * description would describe the wrong building.
 */
export const wikiSummary = async (
  congregationName: string,
  churchName: string,
  city: string,
): Promise<SourceText | null> => {
  const englishToEstonian = churchName
    .replace(/Cathedral/i, 'toomkirik')
    .replace(/\bChurch\b/i, 'kirik')
    .replace(/\bSt\.?\s+/gi, '')
  const attempts = [
    { lang: 'et', term: congregationName.replace(/\s+kogudus$/i, ' kirik') },
    { lang: 'et', term: englishToEstonian },
    { lang: 'et', term: `${city} kirik` },
    { lang: 'en', term: `${churchName} Estonia` },
  ]
  for (const attempt of attempts) {
    const key = keyToken(attempt.term)
    try {
      const searchUrl =
        `https://${attempt.lang}.wikipedia.org/w/api.php?action=query&format=json&list=search` +
        `&srlimit=3&srsearch=${encodeURIComponent(attempt.term)}`
      const found = JSON.parse(await fetchText(searchUrl)) as {
        query?: { search?: { title: string }[] }
      }
      for (const hit of found.query?.search ?? []) {
        const summaryUrl =
          `https://${attempt.lang}.wikipedia.org/api/rest_v1/page/summary/` +
          encodeURIComponent(hit.title.replace(/ /g, '_'))
        const summary = JSON.parse(await fetchText(summaryUrl)) as { extract?: string }
        const extract = summary.extract?.trim() ?? ''
        const mentionsPlace = key.length > 2 && extract.toLowerCase().includes(key.toLowerCase())
        if (extract.length >= 40 && CHURCH_WORD.test(extract) && mentionsPlace) {
          return { text: extract, source: `${attempt.lang}.wikipedia:${hit.title}` }
        }
      }
    } catch {
      continue
    }
  }
  return null
}

/** First ~1500 chars of the parish "meist"/"kirikust" page, when the site has one. */
export const parishAboutText = async (parishUrl: string | null): Promise<SourceText | null> => {
  if (!parishUrl) return null
  const home = await fetchText(parishUrl).catch(() => '')
  if (!home) return null
  const doc = new JSDOM(home).window.document
  const candidate = Array.from(doc.querySelectorAll('a[href]'))
    .map((anchor) => anchor.getAttribute('href') ?? '')
    .find((href) => /meist|kirikust|ajalugu|about/i.test(href))
  if (!candidate) return null
  const pageUrl = new URL(candidate, parishUrl).toString()
  const page = await fetchText(pageUrl).catch(() => '')
  if (!page) return null
  const text = new JSDOM(page).window.document.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  return text.length > 400 ? { text: text.slice(0, 1500), source: pageUrl } : null
}
