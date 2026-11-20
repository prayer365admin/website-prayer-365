import { JSDOM } from 'jsdom'

export const EELK_DIRECTORY_URL = 'https://eelk.ee/inc.kogudused.php'

export interface SocialLink {
  url: string
  label: string
}

export interface EelkRow {
  order: number
  regCode: string
  name: string
  deanery: string
  addressLine: string | null
  churchAddressLine: string | null
  phoneLine: string | null
  email: string | null
  website: string | null
  socialLinks: SocialLink[]
  serviceSentence: string
}

/** Block tags only: jsdom has no innerText, and SPAN/A/FONT would split a field in two. */
const BLOCK = new Set([
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TD',
  'TH',
  'DIV',
  'P',
  'LI',
  'UL',
  'OL',
  'BR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
])

const render = (node: Node, out: string[]): void => {
  if (node.nodeType === 3) {
    out.push((node.textContent ?? '').replace(/\u00a0/g, ' '))
    return
  }
  if (node.nodeType !== 1) return
  const tag = (node as Element).tagName.toUpperCase()
  const block = BLOCK.has(tag)
  if (block) out.push('\n')
  for (const child of Array.from(node.childNodes)) render(child, out)
  if (block) out.push('\n')
}

export const linesOf = (element: Element): string[] => {
  const out: string[] = []
  render(element, out)
  return out
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
const REG_CODE = /Reg kood\s*(\d+)/
const DEANERY = /([A-ZÕÄÖÜŠŽ][^,]{1,40}praostkond)/
const ADDRESS = /,\s*\d{5}\s+\S/
const WEBSITE = /^kodulehekülg:\s*(\S+)/i
const SERVICE = /^Jumalateenistus(?:ed)?\b/i
const SOCIAL =
  /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|instagram\.com|youtube\.com|youtu\.be)\/[^\s,;]+/gi
const NOT_A_PROFILE = /sharer|\/plugins\/|\/tr\?|intent\/tweet|share\.php|dialog\/feed/i

const absolute = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, 'https://')
  return `https://${trimmed.replace(/^\/\//, '')}`
}

const socialLinksFrom = (lines: string[]): SocialLink[] => {
  const links: SocialLink[] = []
  for (const line of lines) {
    for (const hit of line.match(SOCIAL) ?? []) {
      if (NOT_A_PROFILE.test(hit)) continue
      const url = absolute(hit).replace(/^https:\/\/www\./, 'https://')
      if (links.some((link) => link.url === url)) continue
      const label = /instagram/i.test(url)
        ? 'Instagram'
        : /youtu/i.test(url)
          ? 'YouTube'
          : 'Facebook'
      links.push({ url, label })
    }
  }
  return links
}

export const parseDirectory = (html: string): EelkRow[] => {
  const document = new JSDOM(html).window.document
  const tables = Array.from(document.querySelectorAll('table'))

  return tables.map((table, index) => {
    const order = index + 1
    const lines = linesOf(table)
    const nameLine =
      lines.find((line) => /kogudus/i.test(line) && !/arvelduskonto/i.test(line)) ?? ''
    if (!nameLine) throw new Error(`row ${order}: no congregation name line`)
    const name = nameLine
      .replace(/,\s*[^,]*praostkond\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    const flat = lines.join('\n')
    const regCode = flat.match(REG_CODE)?.[1] ?? ''
    if (!regCode) throw new Error(`row ${order} (${name}): no reg code`)
    const phoneLine = lines.find((line) => /^tel\b/i.test(line)) ?? null
    const websiteLine = lines.find((line) => WEBSITE.test(line)) ?? null
    return {
      order,
      regCode,
      name,
      deanery: nameLine.match(DEANERY)?.[1]?.trim() ?? '',
      // "Reg kood 80211219" also contains five digits; the address needs the ", 74501 Harjumaa" tail.
      addressLine: lines.find((line) => ADDRESS.test(line) && !/^Reg kood/i.test(line)) ?? null,
      churchAddressLine: lines.find((line) => /^kiriku aadress:/i.test(line)) ?? null,
      phoneLine,
      email: (phoneLine ?? flat).match(EMAIL)?.[0]?.toLowerCase() ?? null,
      website: websiteLine ? absolute(websiteLine.match(WEBSITE)?.[1] ?? '') : null,
      socialLinks: socialLinksFrom(lines),
      serviceSentence: lines.find((line) => SERVICE.test(line)) ?? '',
    }
  })
}
