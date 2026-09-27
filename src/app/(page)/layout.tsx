import ContainerPage from '@/components/container/page'

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <ContainerPage>{children}</ContainerPage>
}
