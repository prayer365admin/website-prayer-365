'use client'

import { ChurchIcon } from '@/components/icon/church'
import { LanguageIcon } from '@/components/icon/language'
import { SITE_LOCALES, SITE_LOCALE_NAMES, SiteLocale } from '@/config/site-locale'
import { useMe, useMyChurches } from '@/hooks/data/site/me'
import { useSiteI18n } from '@/i18n/site-i18n'
import { isCustomerRole } from '@/utils/customer-role'
import { STAFF_HOME } from '@/utils/constant'
import type { MobileMe, MobileMyChurch } from '@/models/mobile'
import {
  ArrowRightOutlined,
  BellOutlined,
  CheckOutlined,
  DownOutlined,
  HomeOutlined,
  MenuOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Drawer, Modal, Select } from 'antd'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import s from './top-bar.module.scss'

// Hidden until the notifications page exists; flip to show the bell again.
const SHOW_NOTIFICATIONS = false

/** True when the path is the link target or a page below it. */
const isPathWithin = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/**
 * "Giving & Stewardship" points at the church portal (`/donate`). A visitor
 * without a session is sent to public giving (`/give`) by the proxy, and both
 * guest is sent to public giving (`/give`) by the proxy. Both land on the one
 * outcome page (`/donate/result`), so the entry stays highlighted throughout.
 */
const GIVING_PATHS = ['/donate', '/give']

const DAILY_PRAYER_PATH = '/prayers/general'

const isActivePath = (pathname: string, href: string) => {
  if (href === '/donate') return GIVING_PATHS.some((target) => isPathWithin(pathname, target))
  // The daily cycle is its own entry, so the prayer archive must not light up with it.
  if (href === '/prayers')
    return isPathWithin(pathname, href) && !isPathWithin(pathname, DAILY_PRAYER_PATH)
  return isPathWithin(pathname, href)
}

/**
 * One header for every page. There is no per-page variant any more: what a visitor
 * may use is decided by the session, not by the page they happen to be on, so the
 * bar cannot drift between "marketing" and "account" shapes.
 */
export default function SiteTopBar({
  initialMe,
  initialChurches,
}: {
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
  const [navMenuOpen, setNavMenuOpen] = useState(false)

  // Server data counts too: the first paint on a signed-in page must not flash guest entries.
  const signedIn = Boolean(session?.user || me)

  const authLinks = [
    { active: pathname === '/login', href: '/login', label: t('headerSignIn') },
    {
      active: pathname === '/register' || pathname === '/customer/setup',
      href: '/register',
      label: t('signInBeginFellowship'),
    },
  ]

  /*
   * Availability is data, not layout: an entry that needs a session is dropped
   * for a guest instead of leading them into a sign-in bounce. `/donate` stays
   * listed for everyone — the proxy branches it into public giving when there is
   * no session, so the destination is always a giving screen.
   */
  const navItems: Array<{ href: string; label: string; requiresSession?: boolean }> = [
    { href: '/churches', label: t('headerDiscoverChurches') },
    { href: '/prayers', label: t('headerPrayers'), requiresSession: true },
    { href: DAILY_PRAYER_PATH, label: t('headerDailyPrayer') },
    { href: '/donate', label: t('headerGiving') },
  ]
  const visibleNavItems = navItems.filter((item) => signedIn || !item.requiresSession)

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
                  : `/churches/${church.slug}/prayers`
                : `/churches/${church.slug}`
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
    <Select<SiteLocale>
      aria-label={t('language')}
      className={s.languageSelect}
      onChange={setLocale}
      options={SITE_LOCALES.map((code) => ({ value: code, label: code.toUpperCase() }))}
      popupMatchSelectWidth={false}
      prefix={<LanguageIcon aria-hidden className={s.languageIcon} />}
      suffixIcon={null}
      value={locale}
      variant="borderless"
    />
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

  // Signed in: a STAFF session goes to the dashboard (it has no customer profile
  // data), a customer goes to their profile, where sign-out lives.
  const staffSession = Boolean(session?.user) && !isCustomerRole(session?.user?.role)
  // Only a signed-in visitor has an account destination; a guest gets Sign In /
  // Begin Fellowship instead, so nothing here points at a page they cannot use.
  const accountControl = (
    <Link
      aria-label={staffSession ? t('headerDashboard') : t('account')}
      className={`${s.iconButton} ${s.accountButton}`}
      href={staffSession ? STAFF_HOME : '/customer'}
    >
      {me?.profilePicture ? (
        <Avatar alt="" className={s.accountAvatar} shape="square" src={me.profilePicture} />
      ) : (
        <UserOutlined />
      )}
    </Link>
  )

  return (
    <header className={s.header}>
      <div className={`${s.inner} ${s.generalInner}`}>
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
            className={`${s.iconButton} ${s.homeLink} ${pathname === '/' ? s.homeButton : ''}`}
            href="/"
          >
            <HomeOutlined />
          </Link>
        </div>

        <div className={s.generalContent}>
          <nav aria-label={t('headerPrimaryNav')} className={s.generalNavigation}>
            {visibleNavItems.map((item) => {
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

        <div className={s.actions}>
          {signedIn ? (
            churchControl
          ) : (
            <nav aria-label={t('headerAccountNav')} className={s.authNavigation}>
              {authLinks.map((item) => (
                <Link
                  aria-current={item.active ? 'page' : undefined}
                  className={`${s.navigationLink} ${item.active ? s.activeNavigationLink : ''}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          <div className={s.desktopLocale}>{localeControl}</div>
          {signedIn && accountControl}
          <button
            aria-expanded={navMenuOpen}
            aria-label={t('headerMenu')}
            className={`${s.iconButton} ${s.menuButton}`}
            onClick={() => setNavMenuOpen(true)}
            type="button"
          >
            <MenuOutlined />
          </button>
          {SHOW_NOTIFICATIONS && (
            <Link
              aria-label={t('headerNotifications')}
              className={`${s.iconButton} ${s.notificationButton}`}
              href="/notifications"
            >
              <BellOutlined />
              <span aria-hidden className={s.notificationDot} />
            </Link>
          )}
        </div>
      </div>

      {/* Below the desktop breakpoint the header hides the nav links and locale; this drawer carries them. */}
      <Drawer
        onClose={() => setNavMenuOpen(false)}
        open={navMenuOpen}
        size="100%"
        title={t('headerMenu')}
      >
        <nav aria-label={t('headerPrimaryNav')} className={s.drawerNavigation}>
          {[{ href: '/', label: t('headerHome') }, ...visibleNavItems].map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : isActivePath(pathname, item.href)

            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={`${s.navigationLink} ${isActive ? s.activeNavigationLink : ''}`}
                href={item.href}
                key={item.href}
                onClick={() => setNavMenuOpen(false)}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        {!signedIn && (
          <nav aria-label={t('headerAccountNav')} className={s.drawerNavigation}>
            {authLinks.map((item) => (
              <Link
                aria-current={item.active ? 'page' : undefined}
                className={`${s.navigationLink} ${item.active ? s.activeNavigationLink : ''}`}
                href={item.href}
                key={item.href}
                onClick={() => setNavMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <div className={s.drawerLocaleRow}>
          <Select<SiteLocale>
            aria-label={t('language')}
            className={s.drawerLocale}
            onChange={setLocale}
            options={SITE_LOCALES.map((code) => ({
              value: code,
              label: SITE_LOCALE_NAMES[code],
            }))}
            prefix={<LanguageIcon aria-hidden className={s.drawerLocaleIcon} />}
            value={locale}
          />
        </div>
      </Drawer>
    </header>
  )
}
