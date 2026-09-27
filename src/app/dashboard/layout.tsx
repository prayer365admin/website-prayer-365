import { auth } from '@/auth'
import MainContainer from '@/components/container/dashboard'
import { redirect } from 'next/navigation'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) {
    redirect('/login')
  }

  return <MainContainer>{children}</MainContainer>
}
