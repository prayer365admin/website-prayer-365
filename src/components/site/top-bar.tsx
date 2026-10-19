'use client'

import { ChurchIcon } from '@/components/icon/church'
import { LanguageIcon } from '@/components/icon/language'
import { SITE_LOCALES, SiteLocale } from '@/config/site-locale'
import { useMyChurches } from '@/hooks/data/site/me'
import { useSiteI18n } from '@/i18n/site-i18n'
import {
  BellOutlined,
  DownOutlined,
  HomeOutlined,
  LogoutOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Dropdown, Select } from 'antd'
import type { MenuProps } from 'antd'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import s from './top-bar.module.scss'

export type SiteHeaderVariant = 'auth' | 'general'

const authLinks = [
  { href: '/login', label: 'Sign In' },
  { href: '/register', label: 'Begin Fellowship', primary: true },
  { href: '/', label: 'Spiritual Walk' },
]

const generalLinks = [
  { href: '/churches', label: 'Discover Churches' },
  { href: '/events', label: 'Activity & Events' },
  { href: '/giving', label: 'Giving & Stewardship' },
  { href: '/prayers', label: 'Prayers & Liturgies' },
]

export default function SiteTopBar({ variant = 'general' }: { variant?: SiteHeaderVariant }) {
  const { locale, setLocale, t } = useSiteI18n()
  const { data: session } = useSession()
  const { data: churches } = useMyChurches()
  const pathname = usePathname()
  const mainChurch = churches.find((church) => church.isMain) ?? churches[0]

  const churchMenu: MenuProps['items'] = churches.length
    ? churches.map((church) => ({
        key: church.churchId,
        label: <Link href={`/churches/${church.churchId}`}>{church.churchName}</Link>,
      }))
    : [{ key: 'empty', label: 'No churches available', disabled: true }]

  const accountMenu: MenuProps['items'] = [
    {
      key: 'profile',
      label: <Link href="/customer">{t('account')}</Link>,
      icon: <UserOutlined />,
    },
    {
      key: 'logout',
      label: t('signOut'),
      icon: <LogoutOutlined />,
      onClick: () => signOut({ callbackUrl: '/login' }),
    },
  ]

  const localeControl = (
    <div className={s.locale}>
      <LanguageIcon aria-hidden />
      <Select<SiteLocale>
        aria-label={t('language')}
        className={s.languageSelect}
        onChange={setLocale}
        options={SITE_LOCALES.map((code) => ({ value: code, label: code.toUpperCase() }))}
        popupMatchSelectWidth={false}
        suffixIcon={null}
        value={locale}
        variant="borderless"
      />
    </div>
  )

  const churchControl = (
    <Dropdown menu={{ items: churchMenu }} placement="bottomRight" trigger={['click']}>
      <button aria-label="Choose a church" className={s.churchPill} type="button">
        <ChurchIcon aria-hidden />
        <span>{mainChurch?.churchName ?? 'Choose a church'}</span>
        <DownOutlined className={s.churchChevron} />
      </button>
    </Dropdown>
  )

  const accountControl = session?.user ? (
    <Dropdown menu={{ items: accountMenu }} placement="bottomRight" trigger={['click']}>
      <button
        aria-label={t('account')}
        className={`${s.iconButton} ${s.accountButton}`}
        type="button"
      >
        <UserOutlined />
      </button>
    </Dropdown>
  ) : (
    <Link aria-label={t('account')} className={`${s.iconButton} ${s.accountButton}`} href="/login">
      <UserOutlined />
    </Link>
  )

  return (
    <header className={s.header}>
      <div className={`${s.inner} ${variant === 'auth' ? s.authInner : s.generalInner}`}>
        <div className={s.brandGroup}>
          <Link aria-label="Prayer 365 home" className={s.logoLink} href="/">
            <Image
              alt=""
              className={s.logo}
              height={32}
              priority
              src="/images/icon.jpg"
              width={32}
            />
          </Link>
          <Link
            aria-current={pathname === '/' ? 'page' : undefined}
            aria-label="Home"
            className={`${s.iconButton} ${pathname === '/' ? s.homeButton : ''}`}
            href="/"
          >
            <HomeOutlined />
          </Link>
        </div>

        {variant === 'auth' ? (
          <nav aria-label="Account navigation" className={s.authNavigation}>
            {authLinks.map((item) => (
              <Link
                aria-current={pathname === item.href ? 'page' : undefined}
                className={item.primary ? s.primaryLink : s.navigationLink}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : (
          <div className={s.generalContent}>
            <nav aria-label="Primary navigation" className={s.generalNavigation}>
              {generalLinks.map((item) => (
                <Link className={s.navigationLink} href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            {churchControl}
          </div>
        )}

        <div className={s.actions}>
          {variant === 'general' && (
            <Link
              aria-label="Search"
              className={`${s.iconButton} ${s.searchButton}`}
              href="/search"
            >
              <SearchOutlined />
            </Link>
          )}
          <div className={s.desktopLocale}>{localeControl}</div>
          {variant === 'general' && (
            <Link
              aria-label="Notifications"
              className={`${s.iconButton} ${s.notificationButton}`}
              href="/notifications"
            >
              <BellOutlined />
              <span aria-hidden className={s.notificationDot} />
            </Link>
          )}
          {accountControl}
        </div>
      </div>
    </header>
  )
}
