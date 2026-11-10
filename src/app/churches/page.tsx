import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_NAME } from '@/config/site-brand'
import ContentsSiteChurchDirectory from '@/contents/site/church-directory'
import { listPublicChurches } from '@/controller/mobile'
import { siteT } from '@/i18n/messages'
import { MobileChurchListQuerySchema } from '@/models/mobile'
import { getSiteLocale } from '@/utils/site-locale'

export const metadata: Metadata = {
  title: 'Churches & Parishes',
  description: `Browse the churches and parishes of the ${SITE_NAME} fellowship — addresses, denominations and service times.`,
  alternates: { canonical: '/churches' },
  robots: { index: true, follow: true },
}

/*
 * The interactive directory (search, map, pagination) stays a client component.
 * The plain link list underneath exists so the church URLs are real anchors in
 * the server HTML — a crawler needs them, and the sitemap only covers discovery.
 */
export default async function Page() {
  const [locale, query] = await Promise.all([
    getSiteLocale(),
    Promise.resolve(MobileChurchListQuerySchema.parse({ page: 1, limit: 100 })),
  ])
  const t = siteT(locale)
  const { result } = await listPublicChurches({ query }).catch(() => ({ result: [], total: 0 }))
  const churches = result.filter((church) => church.slug)

  return (
    <>
      <ContentsSiteChurchDirectory />
      <nav
        aria-label={t('churchDirectoryAllHeading')}
        className="mx-auto w-full max-w-[1152px] px-4 pb-16"
      >
        <h2 className="mb-4 text-xl font-semibold text-[#0E203E]">
          {t('churchDirectoryAllHeading')}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {churches.map((church) => (
            <li key={church.id}>
              <Link
                className="text-sm text-[#2F7AD2] hover:underline"
                href={`/churches/${church.slug}`}
              >
                {church.name}
                {church.city ? ` — ${church.city}` : ''}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
