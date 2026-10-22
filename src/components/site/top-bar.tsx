'use client'

import { ChurchIcon } from '@/components/icon/church'
import { LanguageIcon } from '@/components/icon/language'
import { SITE_LOCALES, SiteLocale } from '@/config/site-locale'
import { useMe, useMyChurches } from '@/hooks/data/site/me'
import { useSiteI18n } from '@/i18n/site-i18n'
import type { MobileMe, MobileMyChurch } from '@/models/mobile'
import {
  ArrowRightOutlined,
  CheckOutlined,
  DownOutlined,
  HomeOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Modal, Select } from 'antd'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
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
  const searchParams = useSearchParams()
  const mainChurch = churches.find((church) => church.isMain) ?? churches[0]
  const churchPrayerMatch = pathname.match(/^\/churches\/([^/]+)\/prayers(?:\/|$)/)
  const prayerChurchId =
    pathname === '/prayers' ? searchParams.get('churchId') : churchPrayerMatch?.[1]
  const selectedChurch = churches.find((church) => church.churchId === prayerChurchId) ?? mainChurch
  const isPrayerArchive = pathname === '/prayers' || Boolean(churchPrayerMatch)
  const [churchMenuOpen, setChurchMenuOpen] = useState(false)
  const closeChurchMenu = () => setChurchMenuOpen(false)

  const authLinks = [
    { active: pathname === '/login', href: '/login', label: t('headerSignIn') },
    {
      active: pathname === '/register' || pathname === '/customer/setup',
      href: '/register',
      label: t('signInBeginFellowship'),
    },
  ]

  const generalLinks = [
    { href: '/churches', label: t('headerDiscoverChurches') },
    { href: '/prayers', label: t('headerPrayers') },
    { href: '/giving', label: t('headerGiving') },
  ]

  const churchLinks = churches.length
    ? churches.map((church) => {
        const selected = church.churchId === selectedChurch?.churchId
        const context = [church.city, church.isMain ? t('homeHabitsMain') : null]
          .filter(Boolean)
          .join(' · ')

        return (
          <Link
            aria-current={selected ? 'page' : undefined}
            aria-label={church.churchName}
            className={`${s.churchMenuLink} ${selected ? s.churchMenuLinkSelected : ''}`}
            href={
              isPrayerArchive
                ? pathname === '/prayers'
                  ? `/prayers?churchId=${encodeURIComponent(church.churchId)}`
                  : `/churches/${church.churchId}/prayers`
                : `/churches/${church.churchId}`
            }
            key={church.churchId}
            onClick={closeChurchMenu}
          >
            <span className={s.churchMenuIcon}>
              <ChurchIcon aria-hidden />
            </span>
            <span className={s.churchMenuCopy}>
              <span className={s.churchMenuName}>{church.churchName}</span>
              {context && <span className={s.churchMenuMeta}>{context}</span>}
            </span>
            {selected && <CheckOutlined className={s.churchMenuCheck} />}
          </Link>
        )
      })
    : [
        <Link className={s.churchMenuLink} href="/churches" key="browse" onClick={closeChurchMenu}>
          <span className={s.churchMenuIcon}>
            <ChurchIcon aria-hidden />
          </span>
          <span className={s.churchMenuCopy}>
            <span className={s.churchMenuName}>{t('headerBrowseChurches')}</span>
          </span>
        </Link>,
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
    <>
      <button
        aria-expanded={churchMenuOpen}
        aria-label={t('headerChooseChurch')}
        className={s.churchPill}
        onClick={() => setChurchMenuOpen(true)}
        type="button"
      >
        <ChurchIcon aria-hidden />
        <span className={s.churchPillLabel}>
          {selectedChurch?.churchName ?? t('headerChooseChurch')}
        </span>
        <DownOutlined className={s.churchChevron} />
      </button>

      <Modal
        centered
        className={s.churchPickerModal}
        destroyOnHidden
        footer={
          churches.length > 0 ? (
            <Link className={s.churchDropdownBrowse} href="/churches" onClick={closeChurchMenu}>
              {t('headerBrowseChurches')}
              <ArrowRightOutlined aria-hidden className={s.churchDropdownBrowseIcon} />
            </Link>
          ) : null
        }
        onCancel={closeChurchMenu}
        open={churchMenuOpen}
        title={
          <span className={s.churchModalTitle}>
            <span>
              <span className={s.churchDropdownEyebrow}>{t('headerChooseChurch')}</span>
              <span className={s.churchDropdownHint}>{t('prayerArchiveChurchContext')}</span>
            </span>
            <span className={s.churchDropdownCount}>{churches.length}</span>
          </span>
        }
        width="min(560px, calc(100vw - 24px))"
      >
        <nav aria-label={t('headerChooseChurch')} className={s.churchDropdownList}>
          {churchLinks}
        </nav>
      </Modal>
    </>
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
          {variant === 'general' && (
            <Link
              aria-current={pathname === '/' ? 'page' : undefined}
              aria-label={t('headerHome')}
              className={`${s.iconButton} ${pathname === '/' ? s.homeButton : ''}`}
              href="/"
            >
              <HomeOutlined />
            </Link>
          )}
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
          </div>
        )}

        <div className={s.actions}>
          {variant === 'general' && churchControl}
          <div className={s.desktopLocale}>{localeControl}</div>
          {variant === 'general' && accountControl}
        </div>
      </div>
    </header>
  )
}
