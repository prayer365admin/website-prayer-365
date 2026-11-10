/**
 * Product identity for every head tag, crawl file and manifest.
 *
 * Brand form decided by the owner: "Prayer 365" for the website, "Prayer 365
 * Admin Suite" for the staff dashboard. Nothing here may fall back to the
 * template name this repo was scaffolded from.
 */
export const SITE_NAME = 'Prayer 365'
export const SITE_TAGLINE = 'Ecumenical prayer platform'
export const ADMIN_SUITE_NAME = 'Prayer 365 Admin Suite'

export const SITE_DESCRIPTION =
  'Prayer 365 is an ecumenical Christian prayer platform: pray with your church every day, follow the daily liturgy, discover parishes near you and give with stewardship.'

export const SITE_KEYWORDS = [
  'Prayer 365',
  'ecumenical prayer',
  'daily prayer',
  'church directory',
  'parish prayers',
  'Christian devotional',
  'online prayer community',
]

/**
 * Absolute origin used by metadataBase, canonical URLs, sitemap and robots.
 *
 * The http(s) check is load-bearing: Vitest (Vite) sets `process.env.BASE_URL`
 * to its own base path ("/"), so a bare `||` fallback would hand `new URL()` an
 * invalid string and fail every test that imports the root layout.
 */
const RAW_SITE_URL = process.env.BASE_URL?.trim() ?? ''
export const SITE_URL = /^https?:\/\//.test(RAW_SITE_URL)
  ? RAW_SITE_URL.replace(/\/$/, '')
  : 'http://localhost:3000'

export const OG_IMAGE_PATH = '/images/og-prayer-365.png'
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const THEME_COLOR = '#2f7ad2'
