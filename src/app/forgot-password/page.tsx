import ContentsSiteForgotPassword from '@/contents/site/forgot-password'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'

// Forgot password (W04). Shared by customers and staff.
export default async function Page() {
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <ContentsSiteForgotPassword locale={locale} />
    </SiteI18nProvider>
  )
}
