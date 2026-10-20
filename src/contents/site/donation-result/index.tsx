'use client'

import BoxContainer from '@/components/container/boxed'
import { formatMinor } from '@/contents/site/donate/data'
import { useDonationStatus } from '@/hooks/data/site/donation'
import { useSiteI18n } from '@/i18n/site-i18n'
import { DonationStatusView } from '@/models/donation'
import { CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled } from '@ant-design/icons'
import Link from 'next/link'

const STATE_ICON = {
  confirmed: { Icon: CheckCircleFilled, className: 'text-success-500' },
  pending: { Icon: ClockCircleOutlined, className: 'text-warning-500' },
  failed: { Icon: CloseCircleFilled, className: 'text-danger-500' },
}

/** W12 result page (WB-42). The state comes from our ledger; the URL only says which attempt to look at. */
export default function ContentsSiteDonationResult({
  initialStatus,
  attempt,
}: {
  initialStatus: DonationStatusView
  attempt: {
    sessionId: string
    churchId: string
    amountMinor: number
    currency: string
    frequency: 'one_time' | 'monthly'
  }
}) {
  const { locale, t } = useSiteI18n()
  // Re-poll only while nothing is settled; a settled state never downgrades.
  const { status, checking } = useDonationStatus({
    attempt,
    enabled: initialStatus.state === 'pending',
  })
  const current = status ?? initialStatus
  const { Icon, className } = STATE_ICON[current.state]

  const title =
    current.state === 'confirmed'
      ? t('donateResultConfirmedTitle')
      : current.state === 'failed'
        ? t('donateResultFailedTitle')
        : t('donateResultPendingTitle')
  const body =
    current.state === 'failed'
      ? t('donateResultFailedBody')
      : current.state === 'pending'
        ? t(current.receiptSeen ? 'donateResultPendingReceiptBody' : 'donateResultPendingBody')
        : t('donateResultConfirmedBody', { church: current.churchName })

  return (
    <BoxContainer containerClassName="py-8">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
        <section className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <Icon aria-hidden className={className} style={{ fontSize: 40 }} />
          <h1
            aria-live="polite"
            className="font-font_heading text-2xl font-semibold leading-8 text-primary-900"
          >
            {title}
          </h1>
          <p className="max-w-[520px] text-sm leading-[1.5] text-neutral-600">{body}</p>
          {current.state === 'pending' && checking && (
            <p className="text-xs leading-[1.5] text-neutral-500">{t('donateResultChecking')}</p>
          )}

          <dl className="mt-2 grid w-full gap-3 rounded-xl bg-neutral-100 p-4 text-left sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#737C8C]">
                {t('donateResultChurch')}
              </dt>
              <dd className="text-sm font-semibold leading-[1.5] text-primary-900">
                {current.churchName}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#737C8C]">
                {t('donateResultAmount')}
              </dt>
              <dd className="text-sm font-semibold leading-[1.5] text-primary-900">
                {formatMinor(current.amountMinor, current.currency, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#737C8C]">
                {t('donateResultFrequency')}
              </dt>
              <dd className="text-sm font-semibold leading-[1.5] text-primary-900">
                {t(
                  current.frequency === 'monthly'
                    ? 'donateResultFrequencyMonthly'
                    : 'donateResultFrequencyOnce',
                )}
              </dd>
            </div>
          </dl>

          {current.state === 'confirmed' && (
            <div className="w-full rounded-xl bg-primary-100 p-4 text-left">
              <h2 className="text-sm font-semibold leading-[1.5] text-primary-900">
                {t('donateResultNextSteps')}
              </h2>
              <p className="text-xs leading-[1.5] text-neutral-600">
                {t('donateResultNextStepsBody')}
              </p>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            {current.state === 'failed' && (
              <Link
                className="rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white"
                href={`/donate/${attempt.churchId}`}
              >
                {t('donateResultTryAgain')}
              </Link>
            )}
            <Link
              className="text-sm font-semibold text-blue-800 underline-offset-2 hover:underline"
              href={`/donate/${attempt.churchId}`}
            >
              {t('donateResultBack')}
            </Link>
          </div>
        </section>
      </div>
    </BoxContainer>
  )
}
