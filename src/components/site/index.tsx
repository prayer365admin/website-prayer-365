'use client'

import { Layout } from 'antd'
import { ReactNode } from 'react'
import SiteFooter from './footer'
import SiteTopBar, { SiteHeaderVariant } from './top-bar'

export default function SiteShell({
  children,
  footerVariant = 'full',
  headerVariant = 'general',
}: {
  children: ReactNode
  footerVariant?: 'full' | 'legal-only'
  headerVariant?: SiteHeaderVariant
}) {
  return (
    <Layout className="!min-h-screen !bg-[#F7F9FB]">
      <SiteTopBar variant={headerVariant} />
      <div className="min-h-[60vh] flex-1">{children}</div>
      <SiteFooter legalOnly={footerVariant === 'legal-only'} />
    </Layout>
  )
}
