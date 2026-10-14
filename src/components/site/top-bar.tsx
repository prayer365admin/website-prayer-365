'use client'

import { SITE_LOCALES, SITE_LOCALE_NAMES, SiteLocale } from '@/config/site-locale'
import { useSiteI18n } from '@/i18n/site-i18n'
import { Button, Layout, Select, Space } from 'antd'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

export default function SiteTopBar() {
  const { locale, setLocale, t } = useSiteI18n()
  const { data: session } = useSession()

  return (
    <Layout.Header className="flex items-center justify-between gap-2 !bg-white_color !px-4 md:!px-6">
      <Link href="/" className="text-lg font-bold">
        {t('brand')}
      </Link>
      {/* Phones: tighter gaps, narrower select, shortened name, so the row fits 390px. */}
      <Space size="small">
        <Select<SiteLocale>
          aria-label={t('language')}
          className="min-w-[96px] md:min-w-[120px]"
          onChange={setLocale}
          options={SITE_LOCALES.map((code) => ({ value: code, label: SITE_LOCALE_NAMES[code] }))}
          value={locale}
        />
        <Link className="block max-w-[5rem] truncate sm:max-w-none" href="/customer">
          {session?.user?.name ?? t('account')}
        </Link>
        <Button className="!px-1" onClick={() => signOut({ callbackUrl: '/login' })} type="link">
          {t('signOut')}
        </Button>
      </Space>
    </Layout.Header>
  )
}
