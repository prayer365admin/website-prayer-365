'use client'

import BoxContainer from '@/components/container/boxed'
import { formatMinor } from '@/contents/site/donate/data'
import { PLATFORM_GIVE_PATH } from '@/config/platform-church'
import { usePublicDonationStatus } from '@/hooks/data/site/donation'
import { SiteMessageKey } from '@/i18n/messages'
import { useSiteI18n } from '@/i18n/site-i18n'
import { type PublicDonationStatusClientView } from '@/models/donation'
import { CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled } from '@ant-design/icons'
import Link from 'next/link'

const VIEWS: Record<
  PublicDonationStatusClientView['state'],
  { Icon: typeof CheckCircleFilled; className: string; title: SiteMessageKey; body: SiteMessageKey }
> = {
  confirmed: {
    Icon: CheckCircleFilled,
    className: 'text-success-500',
    title: 'publicGiveThanksTitle',
    body: 'publicGiveThanksBody',
  },
  pending: {
    Icon: ClockCircleOutlined,
    className: 'text-warning-500',
    title: 'publicGivePendingTitle',
    body: 'publicGivePendingBody',
  },
  failed: {
    Icon: CloseCircleFilled,
    className: 'text-danger-500',
    title: 'publicGiveFailedTitle',
    body: 'publicGiveFailedBody',
  },
}

/**
 * `/give/thank-you` (PD-UI-03). The outcome comes from our own ledger through
 * the public status endpoint, never from the URL: `session_id` only names the
 * attempt. The page keeps polling while the gift is settling — a paid giver must
 * not be parked on a failure screen by a webhook that is a few seconds late.
 *
 * `initialStatus` is the server's first read, so the page paints the real state
 * instead of a spinner; a `null` there means the server already knows this
 * session is not the platform's own (404) and answers as failed.
 */
export default function ContentsSiteGiveThankYou({
  sessionId,
  initialStatus,
}: {
  sessionId: string | null
  initialStatus: PublicDonationStatusClientView | null
}) {
  const { locale, t } = useSiteI18n()
  const { status } = usePublicDonationStatus({ sessionId, enabled: Boolean(sessionId) })
  const view: PublicDonationStatusClientView = status ??
    initialStatus ?? { state: 'failed', amountMinor: null, currency: null, paidAt: null }
  const { Icon, className, title, body } = VIEWS[view.state]
  const amountLabel =
    view.amountMinor !== null && view.currency
      ? formatMinor(view.amountMinor, view.currency, locale)
      : null

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
          {amountLabel && (
            <p className="text-lg font-semibold leading-7 text-[#0E203E]">{amountLabel}</p>
          )}
          <p className="max-w-[520px] text-sm leading-[1.5] text-neutral-600">{t(body)}</p>
          {view.state === 'confirmed' && (
            <p className="max-w-[520px] text-xs leading-[1.5] text-neutral-500">
              {t('publicGiveThanksEmailNotice')}
            </p>
          )}
          {view.state === 'pending' && (
            <p className="max-w-[520px] text-xs leading-[1.5] text-neutral-500">
              {t('donateResultChecking')}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              className="rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white"
              href={PLATFORM_GIVE_PATH}
            >
              {t('publicGiveBackHome')}
            </Link>
            <Link
              className="text-sm font-semibold text-blue-800 underline-offset-2 hover:underline"
              href="/"
            >
              {t('headerHome')}
            </Link>
          </div>
        </section>
      </div>
    </BoxContainer>
  )
}
