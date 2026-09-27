import { Layout } from 'antd'
import SideBar from './sider'
import MainBreadcrumb from '@/components/common/main-breadcrumb'
import MainHeader from './header'
import MainFooter from './footer'

export default function MainContainer({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <Layout className="min-h-screen">
        <SideBar />
        <Layout>
          <MainHeader />
          <div className="h-[calc(100vh_-_70px_-_60px)] p-6 shadow overflow-y-auto">
            <MainBreadcrumb />
            <div className="mt-5">{children}</div>
          </div>
          <MainFooter />
        </Layout>
      </Layout>
    </>
  )
}
