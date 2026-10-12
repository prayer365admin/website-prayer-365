import { auth } from '@/auth'
import MainContainer from '@/components/container/dashboard'
import { redirect } from 'next/navigation'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) {
    redirect('/admin/login')
  }

  // Role-less sessions are website customers: no admin screens (SPEC §10).
  if (!session.user.role) {
    redirect('/')
  }

  return <MainContainer>{children}</MainContainer>
}
