'use client'

import BoxContainer from '@/components/container/boxed'
import { HandHeartIcon } from '@/components/icon/hand-heart'
import { LockIcon } from '@/components/icon/lock'
import { ShieldCheckIcon } from '@/components/icon/shield-check'
import { SiteMessageKey } from '@/i18n/messages'
import { useSiteI18n } from '@/i18n/site-i18n'
import { GiveForm } from './form'

const TRUST: { id: string; icon: typeof ShieldCheckIcon; body: SiteMessageKey }[] = [
  { id: 'secure', icon: ShieldCheckIcon, body: 'publicGiveTrustSecure' },
  { id: 'provider', icon: LockIcon, body: 'publicGiveTrustProvider' },
  { id: 'account', icon: HandHeartIcon, body: 'publicGiveTrustNoAccount' },
]

/**
 * Public giving (`/give`, PD-UI-01). The one screen a visitor without an account
 * can give from: hero, the plain statement that the gift goes to Prayer 365 and
 * cannot be directed to a parish (the request's own requirement), the trust
 * strip, then the amount form. No scripture, no percentage claim, no tax claim —
 * that copy belongs to a parish fund, not to the platform.
 */
export default function ContentsSiteGive({
  stripeReady,
  presetsMinor,
  currency,
  canceled = false,
}: {
  stripeReady: boolean
  presetsMinor: number[]
  currency: string
  canceled?: boolean
}) {
  const { t } = useSiteI18n()

  return (
    <BoxContainer containerClassName="py-8">
      <div className="mx-auto flex w-full max-w-[896px] flex-col gap-8">
        <section className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)] sm:p-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full blur-[32px] sm:-right-20 sm:size-96"
            style={{
              backgroundImage:
                'linear-gradient(135deg, rgba(131,192,255,0.2) 0%, rgba(0,92,173,0.05) 100%)',
            }}
          />
          <div className="relative rounded-xl bg-primary-100 p-3.5 sm:p-5 md:p-6">
            <div className="mx-auto flex w-full max-w-[896px] flex-col gap-4">
              <span className="inline-flex min-h-[26px] w-fit max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-medium leading-none text-blue-800 sm:px-4 sm:text-xs">
                <HandHeartIcon className="shrink-0" style={{ fontSize: 12, color: '#2F7AD2' }} />
                <span className="truncate">{t('publicGiveEyebrow')}</span>
              </span>
              <h1 className="font-font_heading text-[22px] font-bold leading-7 tracking-[-0.5px] text-[#191C1E] sm:text-[28px] sm:leading-8 md:text-[32px] md:tracking-[-1px]">
                {t('publicGiveTitle')}
              </h1>
              <p className="text-sm leading-[1.5] text-[#414752] sm:text-base sm:leading-6">
                {t('publicGiveLede')}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {TRUST.map(({ id, icon: Icon, body }) => (
            <div className="flex items-start gap-3 rounded-lg bg-white p-3.5" key={id}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-200">
                <Icon style={{ fontSize: 16, color: '#2F7AD2' }} />
              </span>
              <p className="text-xs leading-[1.5] text-[#5C6370]">{t(body)}</p>
            </div>
          ))}
        </div>

        <GiveForm
          canceled={canceled}
          currency={currency}
          presetsMinor={presetsMinor}
          stripeReady={stripeReady}
        />
      </div>
    </BoxContainer>
  )
}
