'use client'

import { useSiteI18n } from '@/i18n/site-i18n'
import { Layout } from 'antd'
import Link from 'next/link'

export default function SiteFooter() {
  const { t } = useSiteI18n()

  return (
    <Layout.Footer className="flex flex-col items-center gap-2 text-sm">
      <div className="flex gap-4">
        <Link href="/about">{t('about')}</Link>
        <Link href="/contact">{t('contact')}</Link>
        <Link href="/privacy">{t('privacy')}</Link>
      </div>
      <span>{t('platformCredit')}</span>
    </Layout.Footer>
  )
}
