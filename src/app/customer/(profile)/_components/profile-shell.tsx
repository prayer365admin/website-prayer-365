'use client'

import SiteButton from '@/components/common/button'
import { BellRingIcon } from '@/components/icon/bell-ring'
import { ChurchIcon } from '@/components/icon/church'
import { GivingIcon } from '@/components/icon/giving'
import { GuardIcon } from '@/components/icon/guard'
import { PersonIcon } from '@/components/icon/person'
import { QuoteIcon } from '@/components/icon/quote'
import { RightLogIcon } from '@/components/icon/right-log'
import { useSiteI18n } from '@/i18n/site-i18n'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import s from './profile-shell.module.scss'

// iconSize is each SVG's native artboard size, so the glyphs render at the design's scale.
const profileMenu = [
  {
    href: '/customer',
    icon: PersonIcon,
    iconSize: 25,
    labelKey: 'profileMenuPersonal',
    ready: true,
  },
  {
    href: '/customer/church-affiliations',
    icon: ChurchIcon,
    iconSize: 20,
    labelKey: 'profileMenuAffiliations',
    ready: true,
  },
  {
    href: '/customer/notifications',
    icon: BellRingIcon,
    iconSize: 12,
    labelKey: 'profileMenuNotifications',
    ready: false,
  },
  {
    href: '/customer/stewardship',
    icon: GivingIcon,
    iconSize: 25,
    labelKey: 'profileMenuStewardship',
    ready: false,
  },
  {
    href: '/customer/privacy',
    icon: GuardIcon,
    iconSize: 20,
    labelKey: 'profileMenuPrivacy',
    ready: true,
  },
] as const

export default function ProfileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { t } = useSiteI18n()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (signingOut) return

    setSigningOut(true)
    try {
      await signOut({ callbackUrl: '/login' })
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <nav aria-label={t('profileNavLabel')}>
          {profileMenu.map(({ href, icon: Icon, iconSize, labelKey, ready }) =>
            ready ? (
              <Link
                aria-current={pathname === href ? 'page' : undefined}
                className={pathname === href ? s.activeMenuItem : s.menuItem}
                href={href}
                key={href}
              >
                <Icon aria-hidden style={{ fontSize: iconSize }} />
                <span>{t(labelKey)}</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={`${s.menuItem} ${s.disabledMenuItem}`}
                key={href}
                title={t('profileMenuComingSoon')}
              >
                <Icon aria-hidden style={{ fontSize: iconSize }} />
                <span>{t(labelKey)}</span>
                <span className="sr-only"> — {t('profileMenuComingSoon')}</span>
              </span>
            ),
          )}
        </nav>

        <section className={s.quote}>
          <div className={s.quoteHeading}>
            <span aria-hidden className={s.quoteIcon}>
              <QuoteIcon />
            </span>
            <strong>{t('profileQuietudeTitle')}</strong>
          </div>
          <div className={s.quoteBody}>
            <blockquote>{t('profileQuietudeQuote')}</blockquote>
            <p>{t('profileQuietudeSource')}</p>
          </div>
        </section>
      </aside>

      <section className={s.content}>{children}</section>

      <SiteButton
        className={s.signOut}
        icon={<RightLogIcon aria-hidden />}
        loading={signingOut}
        onClick={handleSignOut}
        size="md"
      >
        {t('profileSignOut')}
      </SiteButton>
    </div>
  )
}
