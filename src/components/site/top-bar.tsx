'use client'

import { ChurchIcon } from '@/components/icon/church'
import { LanguageIcon } from '@/components/icon/language'
import { SITE_LOCALES, SiteLocale } from '@/config/site-locale'
import { useMe, useMyChurches } from '@/hooks/data/site/me'
import { useSiteI18n } from '@/i18n/site-i18n'
import type { MobileMe, MobileMyChurch } from '@/models/mobile'
import {
  BellOutlined,
  DownOutlined,
  HomeOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Dropdown, Select } from 'antd'
import type { MenuProps } from 'antd'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import s from './top-bar.module.scss'

export type SiteHeaderVariant = 'auth' | 'general'

/** True when the path is the link target or a page below it. */
const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

export default function SiteTopBar({
  variant = 'general',
  initialMe,
  initialChurches,
}: {
  variant?: SiteHeaderVariant
  /** Server-loaded account data, so the avatar and church pill render without waiting for the client session. */
  initialMe?: MobileMe
  initialChurches?: MobileMyChurch[]
}) {
  const { locale, setLocale, t } = useSiteI18n()
  const { data: session } = useSession()
  const { data: churches } = useMyChurches({ userId: initialMe?.id, initialData: initialChurches })
  const { data: me } = useMe({ userId: initialMe?.id, initialData: initialMe })
  const pathname = usePathname()
  const mainChurch = churches.find((church) => church.isMain) ?? churches[0]

  const authLinks = [
    { active: pathname === '/login', href: '/login', label: t('headerSignIn') },
    {
      active: pathname === '/register' || pathname === '/customer/setup',
      href: '/register',
      label: t('signInBeginFellowship'),
    },
    { active: pathname === '/', href: '/', label: t('headerSpiritualWalk') },
  ]

  const generalLinks = [
    { href: '/churches', label: t('headerDiscoverChurches') },
    { href: '/events', label: t('headerEvents') },
    { href: '/donate', label: t('headerGiving') },
    { href: '/prayers', label: t('headerPrayers') },
  ]

  const churchMenu: MenuProps['items'] = churches.length
    ? churches.map((church) => ({
        key: church.churchId,
        label: <Link href={`/churches/${church.slug}`}>{church.churchName}</Link>,
      }))
    : [
        {
          key: 'browse',
          label: <Link href="/churches">{t('headerBrowseChurches')}</Link>,
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
      <button aria-label={t('headerChooseChurch')} className={s.churchPill} type="button">
        <ChurchIcon aria-hidden />
        <span>{mainChurch?.churchName ?? t('headerChooseChurch')}</span>
        <DownOutlined className={s.churchChevron} />
      </button>
    </Dropdown>
  )

  // Signed in: the profile photo (or a user icon) links to the customer profile, where sign-out lives.
  const accountControl =
    session?.user || me ? (
      <Link
        aria-label={t('account')}
        className={`${s.iconButton} ${s.accountButton}`}
        href="/customer"
      >
        {me?.profilePicture ? (
          <Avatar alt="" className={s.accountAvatar} shape="square" src={me.profilePicture} />
        ) : (
          <UserOutlined />
        )}
      </Link>
    ) : (
      <Link
        aria-label={t('account')}
        className={`${s.iconButton} ${s.accountButton}`}
        href="/login"
      >
        <UserOutlined />
      </Link>
    )

  return (
    <header className={s.header}>
      <div className={`${s.inner} ${variant === 'auth' ? s.authInner : s.generalInner}`}>
        <div className={s.brandGroup}>
          <Link aria-label={t('headerPrayerHome')} className={s.logoLink} href="/">
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
            aria-label={t('headerHome')}
            className={`${s.iconButton} ${pathname === '/' ? s.homeButton : ''}`}
            href="/"
          >
            <HomeOutlined />
          </Link>
        </div>

        {variant === 'auth' ? (
          <nav aria-label={t('headerAccountNav')} className={s.authNavigation}>
            {authLinks.map((item) => (
              <Link
                aria-current={item.active ? 'page' : undefined}
                className={item.active ? s.primaryLink : s.navigationLink}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : (
          <div className={s.generalContent}>
            <nav aria-label={t('headerPrimaryNav')} className={s.generalNavigation}>
              {generalLinks.map((item) => {
                const isActive = isActivePath(pathname, item.href)

                return (
                  <Link
                    aria-current={isActive ? 'page' : undefined}
                    className={`${s.navigationLink} ${isActive ? s.activeNavigationLink : ''}`}
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            {churchControl}
          </div>
        )}

        <div className={s.actions}>
          {variant === 'general' && (
            <Link
              aria-label={t('headerSearch')}
              className={`${s.iconButton} ${s.searchButton}`}
              href="/search"
            >
              <SearchOutlined />
            </Link>
          )}
          <div className={s.desktopLocale}>{localeControl}</div>
          {variant === 'general' && (
            <Link
              aria-label={t('headerNotifications')}
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
