import ContentsSiteSignIn from '@/contents/site/sign-in'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import redirectAuthenticatedCustomer from '@/utils/redirect-authenticated-customer'
import { getSiteLocale } from '@/utils/site-locale'

// Customer sign-in (W01). Staff use /admin/login.
export default async function Page() {
  await redirectAuthenticatedCustomer()
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <ContentsSiteSignIn locale={locale} />
    </SiteI18nProvider>
  )
}
