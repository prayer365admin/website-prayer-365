'use client'

import BoxContainer from '@/components/container/boxed'
import DonationConfirmedCard from '@/contents/site/donation-result/confirmed-card'
import ThankYouVideoOverlay from '@/contents/site/donation-result/thank-you-video-overlay'
import { formatMinor } from '@/contents/site/donate/data'
import {
  PLATFORM_CHURCH_NAME,
  PLATFORM_DONATION_CURRENCY,
  PLATFORM_GIVE_PATH,
} from '@/config/platform-church'
import { usePublicDonationStatus } from '@/hooks/data/site/donation'
import { markThankYouVideoSeen, useThankYouVideoSeen } from '@/hooks/data/site/thank-you-video-seen'
import { SiteMessageKey } from '@/i18n/messages'
import { useSiteI18n } from '@/i18n/site-i18n'
import { type PublicDonationStatusClientView } from '@/models/donation'
import { ClockCircleOutlined, CloseCircleFilled } from '@ant-design/icons'
import Link from 'next/link'
import { useCallback, useState } from 'react'

type GuestOutcome = Exclude<PublicDonationStatusClientView['state'], 'confirmed'>

const VIEWS: Record<
  GuestOutcome,
  { Icon: typeof CloseCircleFilled; className: string; title: SiteMessageKey; body: SiteMessageKey }
> = {
  refunded: {
    Icon: CloseCircleFilled,
    className: 'text-warning-500',
    title: 'publicGiveRefundedTitle',
    body: 'publicGiveRefundedBody',
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
  unknown: {
    Icon: ClockCircleOutlined,
    className: 'text-warning-500',
    title: 'publicGiveUnknownTitle',
    body: 'publicGiveUnknownBody',
  },
}

/** No outcome to report: the link is broken, not the gift. */
const UNKNOWN_VIEW: PublicDonationStatusClientView = {
  state: 'unknown',
  amountMinor: null,
  currency: null,
  paidAt: null,
}

/** The integration is off, so no read is possible — not the same as a failed gift. */
const NOT_READY_VIEW: (typeof VIEWS)[keyof typeof VIEWS] = {
  Icon: ClockCircleOutlined,
  className: 'text-warning-500',
  title: 'publicGiveNotReadyTitle',
  body: 'publicGiveNotReadyBody',
}

/**
 * `/donate/result`, guest branch (PD-UI-03). The outcome comes from our own ledger through
 * the public status endpoint, never from the URL: `session_id` only names the
 * attempt. The page keeps polling while the gift is settling — a paid giver must
 * not be parked on a failure screen by a webhook that is a few seconds late.
 *
 * `initialStatus` is the server's first read, so the page paints the real state
 * instead of a spinner. A `null` first read is only a missing outcome when the
 * server said the link is not a checkout (`unknown`) or that giving is not ready
 * (`notReady`); both stop the poll and say so instead of guessing "failed".
 *
 * A confirmed gift renders through the same `DonationConfirmedCard` as the parish
 * branch: same page, same receipt layout, different ledger.
 */
export default function ContentsSiteGiveThankYou({
  sessionId,
  initialStatus,
  unknown = false,
  notReady = false,
}: {
  sessionId: string | null
  initialStatus: PublicDonationStatusClientView | null
  unknown?: boolean
  notReady?: boolean
}) {
  const { locale, t } = useSiteI18n()
  const { status } = usePublicDonationStatus({
    sessionId,
    enabled: Boolean(sessionId) && !unknown && !notReady,
  })
  const view: PublicDonationStatusClientView =
    unknown || notReady
      ? UNKNOWN_VIEW
      : (status ??
        initialStatus ?? { state: 'failed', amountMinor: null, currency: null, paidAt: null })

  // The memory is an external store, so the server snapshot is "not seen" and the
  // browser switches to the real value after hydration.
  const videoSeen = useThankYouVideoSeen(sessionId)
  const [videoDismissed, setVideoDismissed] = useState(false)
  // "Watch video" must reopen a film this tab already remembers.
  const [videoReopened, setVideoReopened] = useState(false)

  const handleVideoComplete = useCallback(() => {
    setVideoDismissed(true)
    if (sessionId) markThankYouVideoSeen(sessionId)
  }, [sessionId])

  const watchVideoAgain = useCallback(() => {
    setVideoDismissed(false)
    setVideoReopened(true)
  }, [])

  const showVideo = view.state === 'confirmed' && !videoDismissed && (videoReopened || !videoSeen)

  if (view.state === 'confirmed') {
    return (
      <>
        {showVideo && <ThankYouVideoOverlay onComplete={handleVideoComplete} />}
        <BoxContainer containerClassName="py-8">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
            <DonationConfirmedCard
              amountMinor={view.amountMinor}
              backHref={PLATFORM_GIVE_PATH}
              body={t('donateResultConfirmedBody', { church: PLATFORM_CHURCH_NAME })}
              churchName={PLATFORM_CHURCH_NAME}
              currency={view.currency ?? PLATFORM_DONATION_CURRENCY}
              frequency="one_time"
              nextStepsBody={t('publicGiveThanksEmailNotice')}
              onWatchVideo={watchVideoAgain}
              title={t('donateResultConfirmedTitle')}
            />
          </div>
        </BoxContainer>
      </>
    )
  }

  const { Icon, className, title, body } = notReady ? NOT_READY_VIEW : VIEWS[view.state]
  const showsOutcome = view.state !== 'unknown'
  const amountLabel =
    showsOutcome && view.amountMinor !== null && view.currency
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
          {view.state === 'refunded' && (
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
            {showsOutcome && (
              <Link
                className="text-sm font-semibold text-blue-800 underline-offset-2 hover:underline"
                href="/"
              >
                {t('headerHome')}
              </Link>
            )}
          </div>
        </section>
      </div>
    </BoxContainer>
  )
}
