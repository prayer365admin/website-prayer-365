import { auth } from '@/auth'
import SiteShell from '@/components/site'
import { DEFAULT_SITE_LOCALE, isSiteLocale, SITE_LOCALE_COOKIE } from '@/config/site-locale'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// Website guard (WB-04): every page in this group needs a customer session.
// Public account pages (/login, /register, /verify-email, /forgot-password,
// /reset-password) live outside this group.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  const store = await cookies()
  const cookieLocale = store.get(SITE_LOCALE_COOKIE)?.value

  return (
    <SiteI18nProvider
      initialLocale={isSiteLocale(cookieLocale) ? cookieLocale : DEFAULT_SITE_LOCALE}
    >
      <SiteShell>{children}</SiteShell>
    </SiteI18nProvider>
  )
}
