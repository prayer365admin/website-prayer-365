import MainFooter from '@/components/container/dashboard/footer'
import MainHeader from '@/components/container/dashboard/header'
import SetupGuard from '@/components/site/setup-guard'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'
import { Layout } from 'antd'

/**
 * Customer profile shell (route group, so /customer/setup stays full-page). It follows the dashboard's fixed header/content/footer
 * structure, but intentionally has no admin sidebar or dashboard breadcrumb.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteI18nProvider initialLocale={await getSiteLocale()}>
      <Layout className="min-h-screen">
        <Layout>
          <SetupGuard />
          <MainHeader logoutCallbackUrl="/login" />
          <main className="h-[calc(100vh_-_70px_-_60px)] overflow-y-auto p-6 shadow">
            {children}
          </main>
          <MainFooter />
        </Layout>
      </Layout>
    </SiteI18nProvider>
  )
}
