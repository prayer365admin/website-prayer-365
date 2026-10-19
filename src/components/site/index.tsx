'use client'

import { Layout } from 'antd'
import { ReactNode } from 'react'
import SiteFooter from './footer'
import SiteTopBar from './top-bar'

export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <Layout className="!min-h-screen !bg-[#F7F9FB]">
      <SiteTopBar />
      <div className="min-h-[60vh]">{children}</div>
      <SiteFooter />
    </Layout>
  )
}
