'use client'

import MaskIcon from '@/components/site/mask-icon'
import { useSiteI18n } from '@/i18n/site-i18n'
import Link from 'next/link'
import { HOME_SHORTCUTS, HomeShortcut, homeCardClassName } from './data'

const cardClassName = `flex h-full flex-col p-5 ${homeCardClassName}`

function ShortcutCard({ shortcut, count }: { shortcut: HomeShortcut; count: number }) {
  const { t } = useSiteI18n()
  const content = (
    <>
      <span
        className={`flex size-12 items-center justify-center rounded-xl ${shortcut.tileClassName}`}
      >
        <MaskIcon className={shortcut.iconClassName} size={20} src={shortcut.icon} />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-primary-900">
        {t(shortcut.title)}
      </h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-neutral-600">{t(shortcut.body)}</p>
      <span className="mt-6 flex items-center justify-between gap-3 text-xs font-medium text-primary-500">
        {t(count === 1 && shortcut.linkOne ? shortcut.linkOne : shortcut.link, { count })}
        {shortcut.href ? (
          <MaskIcon
            className="bg-primary-500 transition group-hover:translate-x-1"
            size={20}
            src="/icons/Icon-arrow-right.svg"
          />
        ) : (
          <span className="rounded-full bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            {t('homeComingSoon')}
          </span>
        )}
      </span>
    </>
  )

  return shortcut.href ? (
    <Link
      className={`${cardClassName} group transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(24,74,140,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500`}
      href={shortcut.href}
    >
      {content}
    </Link>
  ) : (
    <div aria-disabled="true" className={cardClassName}>
      {content}
    </div>
  )
}

/** Home section 2 (`home-2.png`): feature shortcut cards. */
export default function HomeShortcuts({ readyPrayers }: { readyPrayers: number }) {
  return (
    <section
      aria-label="Shortcuts"
      className="mt-6 grid gap-4 sm:grid-cols-2 lg:mt-8 lg:grid-cols-4 lg:gap-6"
    >
      {HOME_SHORTCUTS.map((shortcut) => (
        <ShortcutCard count={readyPrayers} key={shortcut.id} shortcut={shortcut} />
      ))}
    </section>
  )
}
