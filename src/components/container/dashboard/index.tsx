'use client'

import { Layout } from 'antd'
import { useState } from 'react'
import SideBar from './sider'
import MainHeader from './header'
import MainFooter from './footer'
import MainBreadcrumb from '@/components/common/main-breadcrumb'
import s from './index.module.scss'

export default function MainContainer({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <>
      <Layout className="min-h-screen !flex-row">
        <SideBar mobileOpen={mobileSidebarOpen} onMobileOpenChange={setMobileSidebarOpen} />
        <Layout className="min-h-screen min-w-0 !flex-col">
          <MainHeader onMenuClick={() => setMobileSidebarOpen(true)} />
          <div className={`${s.dashboardContent} min-h-0 flex-1 overflow-y-auto bg-[#f7f9fc] p-6`}>
            <div className={s.mobileBreadcrumb}>
              <MainBreadcrumb />
            </div>
            <div>{children}</div>
          </div>
          <MainFooter />
        </Layout>
      </Layout>
    </>
  )
}
