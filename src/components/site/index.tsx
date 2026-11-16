'use client'

import { Layout } from 'antd'
import type { MobileMe, MobileMyChurch } from '@/models/mobile'
import { ReactNode } from 'react'
import SiteFooter from './footer'
import SiteTopBar from './top-bar'

export default function SiteShell({
  children,
  footerVariant = 'full',
  headerVariant = 'general',
  initialMe,
  initialChurches,
}: {
  children: ReactNode
  footerVariant?: 'full' | 'legal-only'
  /** `none` hides the header; every other value renders the same one header. */
  headerVariant?: 'general' | 'auth' | 'none'
  initialMe?: MobileMe
  initialChurches?: MobileMyChurch[]
}) {
  return (
    <Layout className="!min-h-screen !bg-[#F7F9FB]">
      {headerVariant !== 'none' && (
        <SiteTopBar initialChurches={initialChurches} initialMe={initialMe} />
      )}
      <div className="min-h-[60vh] flex-1">{children}</div>
      <SiteFooter legalOnly={footerVariant === 'legal-only'} />
    </Layout>
  )
}
