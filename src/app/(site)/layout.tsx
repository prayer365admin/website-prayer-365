import { auth } from '@/auth'
import SiteShell from '@/components/site'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'
import { redirect } from 'next/navigation'

// Website guard (WB-04): every page in this group needs a customer session.
// Public account pages (/login, /register, /verify-email, /forgot-password,
// /reset-password) live outside this group.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  return (
    <SiteI18nProvider initialLocale={await getSiteLocale()}>
      <SiteShell>{children}</SiteShell>
    </SiteI18nProvider>
  )
}
