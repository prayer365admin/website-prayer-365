import ContentsSiteMaintenance from '@/contents/site/maintenance'
import { isMaintenanceEnabled } from '@/utils/maintenance'
import { getSiteLocale } from '@/utils/site-locale'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'

/*
 * Maintenance screen route (NEXT_PUBLIC_IS_MAINTENANCE). A public page, so it
 * lives OUTSIDE the `(site)` group — that layout calls requiredWebAuth() and
 * would send every visitor to /welcome. While the flag is anything but "true"
 * the URL sends the visitor home, so the screen is live exactly when the switch
 * says so.
 *
 * No site chrome on purpose: the screen replaces the header and footer, like the
 * sign-in page. src/proxy.ts sends every other page here while the flag is on;
 * /admin and /login stay reachable so staff can keep working.
 */
export const metadata: Metadata = {
  title: 'Prayer 365 — Coming Soon',
  robots: { index: false, follow: false },
}

export default async function Page() {
  if (!isMaintenanceEnabled()) redirect('/')

  return <ContentsSiteMaintenance locale={await getSiteLocale()} />
}
