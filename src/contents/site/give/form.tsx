'use client'

import { formatMinor } from '@/contents/site/donate/data'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { HandHeartIcon } from '@/components/icon/hand-heart'
import { useInitiatePublicDonation } from '@/hooks/data/site/donation'
import { useSiteI18n } from '@/i18n/site-i18n'
import { SiteMessageKey } from '@/i18n/messages'
import { PLATFORM_DONATION_MAX_MINOR, PLATFORM_DONATION_MIN_MINOR } from '@/config/platform-church'
import { redirectExternal } from '@/utils/redirect-external'
import axios from 'axios'
import Link from 'next/link'
import { useState } from 'react'

/**
 * Caption per preset, in ladder order. The presets come from the server
 * (`PLATFORM_DONATION_PRESETS_MINOR`), so a longer ladder falls back to the last
 * caption instead of rendering an empty label.
 */
const PRESET_CAPTIONS: SiteMessageKey[] = [
  'publicGivePresetSupport',
  'publicGivePresetCare',
  'publicGivePresetMusic',
  'publicGivePresetPillar',
]

/** Euros-and-cents text → minor units, or null when the reader typed something unusable. */
const parseMinor = (raw: string) => {
  const normalized = raw.replace(/\s/g, '').replace(',', '.')
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null
  const minor = Math.round(Number(normalized) * 100)
  return minor > 0 ? minor : null
}

/**
 * The whole guest offering form (PD-UI-02).
 *
 * No parish picker, no ministry-purpose grid and no monthly switch: a visitor
 * gives to Prayer 365 itself and nothing else (D-04, D-05). The beneficiary is
 * resolved server-side, so this component never sends a church id — the amount
 * is the only thing the reader decides.
 */
export function GiveForm({
  presetsMinor,
  currency,
  stripeReady,
  canceled = false,
}: {
  presetsMinor: number[]
  currency: string
  stripeReady: boolean
  /** Arrived back from a cancelled checkout (`/give?canceled=1`). */
  canceled?: boolean
}) {
  const { locale, t } = useSiteI18n()
  const { onInitiate, initiating } = useInitiatePublicDonation()
  const [presetMinor, setPresetMinor] = useState<number | null>(presetsMinor[0] ?? null)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)

  const customMinor = custom.trim() ? parseMinor(custom) : null
  const typedAmount = custom.trim().length > 0
  const amountMinor = typedAmount ? customMinor : presetMinor
  const amountInRange =
    amountMinor !== null &&
    amountMinor >= PLATFORM_DONATION_MIN_MINOR &&
    amountMinor <= PLATFORM_DONATION_MAX_MINOR
  const canSubmit = stripeReady && !initiating && amountInRange
  const amountLabel =
    amountInRange && amountMinor !== null ? formatMinor(amountMinor, currency, locale) : ''

  const onComplete = async () => {
    if (!canSubmit || amountMinor === null) return
    setError(null)
    try {
      const result = await onInitiate({
        input: { amountMinor, currency: currency.toLowerCase(), frequency: 'one_time' },
      })
      redirectExternal(result.url)
    } catch (e) {
      const notReady = axios.isAxiosError(e) && e.response?.status === 503
      setError(t(notReady ? 'publicGiveNotReady' : 'publicGiveInitiateFailed'))
    }
  }

  return (
    <section
      aria-labelledby="give-form-title"
      className="min-w-0 self-start rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <div className="border-b border-neutral-200 p-4">
        <h2
          className="font-font_heading text-2xl font-semibold leading-6 tracking-[-1px] text-primary-900"
          id="give-form-title"
        >
          {t('publicGiveAmountLabel')}
        </h2>
      </div>

      <div className="flex flex-col gap-6 p-4">
        <p className="flex items-start gap-2 rounded-lg bg-[#F5F7FF] p-3 text-sm leading-[1.5] text-[#0E203E]">
          <HandHeartIcon
            aria-hidden
            className="mt-0.5 shrink-0"
            style={{ fontSize: 14, color: '#2F7AD2' }}
          />
          <span>{t('publicGiveBeneficiaryNotice')}</span>
        </p>

        {canceled && (
          <p aria-live="polite" className="text-sm leading-[1.5] text-[#5C6370]">
            {t('publicGiveCanceledNotice')}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-end gap-2 px-1">
            <span className="text-xs leading-[1.5] text-[#5C6370]">
              {t('donateCurrencyLabel', { currency })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {presetsMinor.map((minor, index) => {
              const selected = !typedAmount && presetMinor === minor
              return (
                <button
                  aria-pressed={selected}
                  className={`relative flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-lg bg-[#F5F7FF] p-3 transition-colors ${
                    selected ? 'border border-[#2F7AD2]' : 'border border-transparent'
                  }`}
                  key={minor}
                  onClick={() => {
                    setPresetMinor(minor)
                    setCustom('')
                  }}
                  type="button"
                >
                  <span
                    className={`text-base font-semibold leading-6 ${
                      selected ? 'text-[#2F7AD2]' : 'text-[#5C6370]'
                    }`}
                  >
                    {formatMinor(minor, currency, locale)}
                  </span>
                  <span className="text-xs leading-[1.5] text-[#5C6370]">
                    {t(PRESET_CAPTIONS[index] ?? PRESET_CAPTIONS[PRESET_CAPTIONS.length - 1])}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute left-3 top-3 flex size-4 items-center justify-center rounded-full"
                    style={{ backgroundColor: selected ? '#2F7AD2' : '#DDE0E4' }}
                  >
                    <span className="size-[5px] rounded-full bg-white" />
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex h-12 items-center gap-3 rounded-lg border border-[#DDE0E4] bg-white px-2">
            <span aria-hidden="true" className="text-sm leading-[1.5] text-[#0E203E]">
              €
            </span>
            <input
              aria-label={t('publicGiveCustomAmount')}
              className="min-w-0 flex-1 bg-transparent text-sm leading-[1.5] text-[#0E203E] outline-none placeholder:text-[#0E203E]/45"
              inputMode="decimal"
              onChange={(event) => setCustom(event.target.value)}
              placeholder={t('publicGiveCustomAmount')}
              value={custom}
            />
          </div>
          {typedAmount && !amountInRange && (
            <p aria-live="polite" className="px-1 text-xs leading-[1.5] text-danger-700">
              {t('publicGiveCustomAmountInvalid')}
            </p>
          )}
        </div>

        <p className="text-xs leading-[1.5] text-[#5C6370]">
          {t('publicGiveOneTimeOnly')}{' '}
          <Link
            className="font-semibold text-blue-800 underline-offset-2 hover:underline"
            href="/register"
          >
            {t('signInBeginFellowship')}
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <button
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-primary-600 bg-[#2F7AD2] px-5 py-3 text-base font-semibold leading-6 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit}
          onClick={onComplete}
          title={stripeReady ? undefined : t('publicGiveNotReady')}
          type="button"
        >
          {t('publicGiveCompleteGift', { amount: amountLabel })}
          <ArrowRightIcon aria-hidden style={{ fontSize: 16, color: '#FFFFFF' }} />
        </button>
        {!stripeReady && (
          <p className="text-xs leading-[1.5] text-neutral-600">{t('publicGiveNotReady')}</p>
        )}
        {error && (
          <p aria-live="polite" className="text-xs leading-[1.5] text-danger-700">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
