import ContentsSiteSignUp from '@/contents/site/sign-up'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'

// Customer sign-up (W02), 3 steps.
export default async function Page() {
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <ContentsSiteSignUp locale={locale} />
    </SiteI18nProvider>
  )
}
