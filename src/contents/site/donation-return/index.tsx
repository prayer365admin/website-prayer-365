'use client'

import BoxContainer from '@/components/container/boxed'
import { useSiteI18n } from '@/i18n/site-i18n'
import { type SiteMessageKey } from '@/i18n/messages'
import { CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled } from '@ant-design/icons'
import Link from 'next/link'

/*
 * F11 return landing page (the no-app / unverified-link fallback).
 *
 * The mobile app claims `<origin>/donations/*` as a universal link, so a giver with
 * the app installed never sees this page. Everyone else does: a browser that failed
 * verification, a desktop, a phone without the app. It reads NOTHING — no session, no
 * ledger, no amount — because the query string here is only `outcome` + the provider's
 * session id, and a public page must never be able to suggest a payment succeeded.
 */

const VIEWS: Record<
  'success' | 'cancel' | 'default',
  { Icon: typeof CheckCircleFilled; className: string; title: SiteMessageKey; body: SiteMessageKey }
> = {
  success: {
    Icon: CheckCircleFilled,
    className: 'text-success-500',
    title: 'donateReturnSuccessTitle',
    body: 'donateReturnSuccessBody',
  },
  cancel: {
    Icon: CloseCircleFilled,
    className: 'text-danger-500',
    title: 'donateReturnCancelTitle',
    body: 'donateReturnCancelBody',
  },
  default: {
    Icon: ClockCircleOutlined,
    className: 'text-warning-500',
    title: 'donateReturnDefaultTitle',
    body: 'donateReturnDefaultBody',
  },
}

const viewFor = (outcome: string | null) => {
  if (outcome === 'success') return VIEWS.success
  if (outcome === 'cancel') return VIEWS.cancel
  return VIEWS.default
}

export default function ContentsSiteDonationReturn({ outcome }: { outcome: string | null }) {
  const { t } = useSiteI18n()
  const { Icon, className, title, body } = viewFor(outcome)

  return (
    <BoxContainer containerClassName="py-8">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
        <section className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <Icon aria-hidden className={className} style={{ fontSize: 40 }} />
          <h1
            aria-live="polite"
            className="font-font_heading text-2xl font-semibold leading-8 text-primary-900"
          >
            {t(title)}
          </h1>
          <p className="max-w-[520px] text-sm leading-[1.5] text-neutral-600">{t(body)}</p>
          <p className="max-w-[520px] text-xs leading-[1.5] text-neutral-500">
            {t('donateReturnCannotConfirm')}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              className="rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white"
              href="/donate"
            >
              {t('donateReturnBackToDonate')}
            </Link>
            <Link
              className="text-sm font-semibold text-blue-800 underline-offset-2 hover:underline"
              href="/churches"
            >
              {t('donateReturnBrowseChurches')}
            </Link>
          </div>
        </section>
      </div>
    </BoxContainer>
  )
}
