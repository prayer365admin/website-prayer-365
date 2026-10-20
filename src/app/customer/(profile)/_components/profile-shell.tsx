'use client'

import SiteButton from '@/components/common/button'
import { BellRingIcon } from '@/components/icon/bell-ring'
import { ChurchIcon } from '@/components/icon/church'
import { GivingIcon } from '@/components/icon/giving'
import { GuardIcon } from '@/components/icon/guard'
import { PersonIcon } from '@/components/icon/person'
import { QuoteIcon } from '@/components/icon/quote'
import { RightLogIcon } from '@/components/icon/right-log'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import s from './profile-shell.module.scss'

// iconSize is each SVG's native artboard size, so the glyphs render at the design's scale.
const profileMenu = [
  { href: '/customer', icon: PersonIcon, iconSize: 25, label: 'Personal Profile', ready: true },
  {
    href: '/customer/church-affiliations',
    icon: ChurchIcon,
    iconSize: 20,
    label: 'Church Affiliations',
    ready: true,
  },
  {
    href: '/customer/notifications',
    icon: BellRingIcon,
    iconSize: 12,
    label: 'Notifications',
    ready: false,
  },
  {
    href: '/customer/stewardship',
    icon: GivingIcon,
    iconSize: 25,
    label: 'Giving & Stewardship',
    ready: false,
  },
  {
    href: '/customer/privacy',
    icon: GuardIcon,
    iconSize: 20,
    label: 'Sacramental Privacy',
    ready: true,
  },
] as const

export default function ProfileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
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
        <nav aria-label="Customer profile">
          {profileMenu.map(({ href, icon: Icon, iconSize, label, ready }) =>
            ready ? (
              <Link
                aria-current={pathname === href ? 'page' : undefined}
                className={pathname === href ? s.activeMenuItem : s.menuItem}
                href={href}
                key={href}
              >
                <Icon aria-hidden style={{ fontSize: iconSize }} />
                <span>{label}</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={`${s.menuItem} ${s.disabledMenuItem}`}
                key={href}
                title="This profile section will be added next"
              >
                <Icon aria-hidden style={{ fontSize: iconSize }} />
                <span>{label}</span>
              </span>
            ),
          )}
        </nav>

        <section className={s.quote}>
          <div className={s.quoteHeading}>
            <span aria-hidden className={s.quoteIcon}>
              <QuoteIcon />
            </span>
            <strong>Daily Quietude</strong>
          </div>
          <div className={s.quoteBody}>
            <blockquote>
              “Take a moment. Breathe. Pray. Be still, and know that I am with you.”
            </blockquote>
            <p>Psalm 46:10 · Parish reflection feed</p>
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
        Sign Out from Prayer 365
      </SiteButton>
    </div>
  )
}
