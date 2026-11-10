import { auth } from '@/auth'
import MainContainer from '@/components/container/dashboard'
import { ADMIN_SUITE_NAME } from '@/config/site-brand'
import { isCustomerRole } from '@/utils/customer-role'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

// Staff surfaces: the Admin Suite owns the title suffix for every dashboard page.
export const metadata: Metadata = {
  title: {
    default: `${ADMIN_SUITE_NAME} — Dashboard`,
    template: `%s — ${ADMIN_SUITE_NAME}`,
  },
  robots: { index: false, follow: false },
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) {
    redirect('/admin/login')
  }

  // Staff only: customers (prayer_user or no role) never see admin screens (SPEC §10, R-01).
  if (isCustomerRole(session.user.role)) {
    redirect('/')
  }

  return <MainContainer>{children}</MainContainer>
}
