import { auth } from '@/auth'
import MainContainer from '@/components/container/dashboard'
import { isCustomerRole } from '@/utils/customer-role'
import { redirect } from 'next/navigation'

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
