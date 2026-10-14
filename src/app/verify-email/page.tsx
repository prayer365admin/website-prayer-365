import ContentsSiteVerify from '@/contents/site/verify'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'

// Email verification (W03, confirm).
export default async function Page() {
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <ContentsSiteVerify locale={locale} mode="confirm" />
    </SiteI18nProvider>
  )
}
