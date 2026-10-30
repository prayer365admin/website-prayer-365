'use client'

import MainBreadcrumb from '@/components/common/main-breadcrumb'
import { Layout } from 'antd'
import { useState } from 'react'
import MainFooter from './footer'
import MainHeader from './header'
import s from './index.module.scss'
import SideBar from './sider'

export default function MainContainer({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <>
      <Layout className={`${s.dashboardShell} !flex-row`}>
        <SideBar mobileOpen={mobileSidebarOpen} onMobileOpenChange={setMobileSidebarOpen} />
        <Layout className={`${s.mainColumn} min-w-0 !flex-col`}>
          <MainHeader onMenuClick={() => setMobileSidebarOpen(true)} />
          <div
            className={`${s.dashboardContent} min-h-0 flex-1 overflow-y-auto bg-neutral-100 p-6`}
          >
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
