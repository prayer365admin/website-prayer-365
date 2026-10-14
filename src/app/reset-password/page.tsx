import ContentsSiteResetPassword from '@/contents/site/reset-password'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'

// Reset password (W04). Shared by customers and staff.
export default async function Page() {
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <ContentsSiteResetPassword locale={locale} />
    </SiteI18nProvider>
  )
}
