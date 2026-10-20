'use client'

import { ChurchIcon } from '@/components/icon/church'
import { MusicIcon } from '@/components/icon/music'
import { UsersGroupIcon } from '@/components/icon/users-group'
import { UtensilsIcon } from '@/components/icon/utensils'
import { useInitiateDonation } from '@/hooks/data/site/donation'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobileDonationOptions } from '@/models/mobile'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { BuildingsIcon } from '@/components/icon/buildings'
import { CreditCardIcon } from '@/components/icon/credit-card'
import { RotateIcon } from '@/components/icon/rotate'
import { ShieldCheckIcon } from '@/components/icon/shield-check'
import axios from 'axios'
import { Select } from 'antd'
import { useRouter } from 'next/navigation'
import { useChurchOptions, useFrequentChurches } from '@/hooks/data/site/church-option'
import { redirectExternal } from '@/utils/redirect-external'
import { type MyActiveGift } from '@/models/donation'
import { useState } from 'react'
import {
  DONATION_FALLBACK_OPTIONS,
  DONATION_PRESET_CAPTIONS,
  DONATION_PURPOSES,
  formatMinor,
} from './data'

const PURPOSE_ICONS = {
  general: ChurchIcon,
  pantry: UtensilsIcon,
  organ: MusicIcon,
  youth: UsersGroupIcon,
}

/** Euros-and-cents text → minor units, or null when the reader typed something unusable. */
const parseMinor = (raw: string) => {
  const normalized = raw.replace(/\s/g, '').replace(',', '.')
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null
  const minor = Math.round(Number(normalized) * 100)
  return minor > 0 ? minor : null
}

/** W11 left column: the whole offering form and its checkout hand-off. */
export function DonorForm({
  churchId,
  churchName,
  isMainParish,
  options,
  activeGift,
  stripeReady,
}: {
  churchId: string
  churchName: string
  isMainParish: boolean
  options: MobileDonationOptions
  activeGift?: MyActiveGift | null
  stripeReady: boolean
}) {
  const { locale, t } = useSiteI18n()
  const { onInitiate, initiating } = useInitiateDonation()
  const router = useRouter()
  const [churchSearch, setChurchSearch] = useState('')
  const { data: searchResults, loading: searchingChurches } = useChurchOptions(churchSearch)
  const { data: frequentChurches } = useFrequentChurches()

  const churchSelectOptions = (() => {
    const map = new Map<string, { id: string; name: string; city?: string | null }>()
    map.set(churchId, {
      id: churchId,
      name: isMainParish ? `${churchName} ${t('donateRegisteredParish')}` : churchName,
    })
    for (const c of frequentChurches) {
      if (!map.has(c.id)) map.set(c.id, c)
    }
    for (const c of searchResults) {
      if (!map.has(c.id)) map.set(c.id, c)
    }
    return Array.from(map.values()).map((c) => ({
      value: c.id,
      label: c.id === churchId ? c.name : c.city ? `${c.name}, ${c.city}` : c.name,
    }))
  })()
  const presets = options.presetsMinor.length
    ? options.presetsMinor
    : DONATION_FALLBACK_OPTIONS.presetsMinor
  const currency = options.currency.toUpperCase()
  const [purpose, setPurpose] = useState(DONATION_PURPOSES[0].id)
  const [monthly, setMonthly] = useState(options.monthlyEnabled)
  const [presetMinor, setPresetMinor] = useState<number | null>(presets[0])
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isReplacingPledge = Boolean(monthly && activeGift && activeGift.churchId === churchId)
  const customMinor = custom.trim() ? parseMinor(custom) : null
  const amountMinor = custom.trim() ? customMinor : presetMinor
  const amountLabel = amountMinor === null ? '' : formatMinor(amountMinor, currency, locale)
  const canSubmit = stripeReady && !initiating && amountMinor !== null

  const onComplete = async () => {
    if (!canSubmit || amountMinor === null) return
    setError(null)
    const origin = window.location.origin
    const frequency = monthly ? 'monthly' : 'one_time'
    try {
      const result = await onInitiate({
        churchId,
        input: {
          amountMinor,
          currency: options.currency.toLowerCase(),
          frequency,
          // Stripe substitutes the session id; the result page re-reads the
          // outcome from our ledger, never from these values.
          successUrl: `${origin}/donate/result?session_id={CHECKOUT_SESSION_ID}&churchId=${churchId}&amountMinor=${amountMinor}&currency=${currency}&frequency=${frequency}`,
          cancelUrl: `${origin}/donate/${churchId}`,
        },
      })
      redirectExternal(result.url)
    } catch (e) {
      const notReady = axios.isAxiosError(e) && e.response?.status === 503
      setError(t(notReady ? 'donateNotReady' : 'donateInitiateFailed'))
    }
  }

  return (
    <section
      aria-labelledby="donate-form-title"
      className="min-w-0 rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <div className="border-b border-neutral-200 p-4">
        <h2
          className="font-font_heading text-2xl font-semibold leading-6 tracking-[-1px] text-primary-900"
          id="donate-form-title"
        >
          {t('donateFormTitle')}
        </h2>
        <p className="mt-2 text-base leading-6 text-neutral-600">{t('donateFormSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-6 p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-sm font-semibold leading-[1.5] text-neutral-700">
              {t('donateBeneficiaryLabel')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs leading-[1.5] text-neutral-600">
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary-500 text-[8px] text-white">
                <ShieldCheckIcon style={{ fontSize: 9 }} />
              </span>
              {t('donateFieldStatus')}
            </span>
          </div>
          <Select
            aria-label={t('donateBeneficiaryLabel')}
            className="w-full !h-12 [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-neutral-200 [&_.ant-select-selection-item]:!flex [&_.ant-select-selection-item]:!items-center [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-neutral-700"
            loading={searchingChurches}
            notFoundContent={t('noChurchesFound')}
            onChange={(nextChurchId: string) => {
              if (nextChurchId && nextChurchId !== churchId) {
                router.push(`/donate/${nextChurchId}`)
              }
            }}
            options={churchSelectOptions}
            prefix={<ChurchIcon style={{ fontSize: 14 }} className="text-primary-900 !me-2" />}
            showSearch={{ filterOption: false, onSearch: setChurchSearch }}
            value={churchId}
          />
        </div>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-3 px-1 text-sm font-semibold leading-[1.5] text-neutral-700">
            {t('donatePurposeLabel')}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {DONATION_PURPOSES.map((item) => {
              const Icon = PURPOSE_ICONS[item.id]
              const selected = purpose === item.id
              return (
                <button
                  key={item.id}
                  aria-pressed={selected}
                  className={`flex items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                    selected
                      ? 'border-2 border-[#2F7AD2] bg-white'
                      : 'border border-transparent bg-[#F5F7FF] hover:bg-blue-50'
                  }`}
                  onClick={() => setPurpose(item.id)}
                  type="button"
                >
                  <Icon style={{ fontSize: 14, color: selected ? '#2F7AD2' : '#8F96A3' }} />
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-semibold leading-[1.5] ${
                        selected ? 'text-[#2F7AD2]' : 'text-[#0E203E]'
                      }`}
                    >
                      {t(item.title)}
                    </span>
                    <span className="block text-xs leading-[1.5] text-[#5C6370]">
                      {t(item.body)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="px-1 text-sm font-semibold leading-[1.5] text-[#393E46]">
            {t('donateFrequencyLabel')}
          </span>
          <div className="flex gap-1 rounded-lg bg-[#F5F7FF] p-1">
            <button
              aria-pressed={monthly}
              className={`h-[41px] flex-1 rounded-md text-sm font-semibold leading-[1.5] transition-colors ${
                monthly
                  ? 'bg-[#2F7AD2] text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-[#8F96A3]'
              }`}
              disabled={!options.monthlyEnabled}
              onClick={() => setMonthly(true)}
              type="button"
            >
              {t('donateFrequencyMonthly')}
            </button>
            <button
              aria-pressed={!monthly}
              className={`h-[41px] flex-1 rounded-md text-sm font-semibold leading-[1.5] transition-colors ${
                monthly
                  ? 'text-[#8F96A3]'
                  : 'bg-[#2F7AD2] text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
              }`}
              onClick={() => setMonthly(false)}
              type="button"
            >
              {t('donateFrequencyOneTime')}
            </button>
          </div>
          {isReplacingPledge && activeGift && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs leading-[1.5] text-primary-900">
              {t('donateReplaceExistingPledgeNotice', {
                amount: formatMinor(activeGift.amountMinor, activeGift.currency, locale),
              })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <span className="text-sm font-semibold leading-[1.5] text-[#393E46]">
              {t('donateAmountLabel')}
            </span>
            <span className="text-xs leading-[1.5] text-[#5C6370]">
              {t('donateCurrencyLabel', { currency })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {presets.map((minor, index) => {
              const selected = !custom.trim() && presetMinor === minor
              return (
                <button
                  key={minor}
                  aria-pressed={selected}
                  className={`relative flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-lg bg-[#F5F7FF] p-3 transition-colors ${
                    selected ? 'border border-[#2F7AD2]' : 'border border-transparent'
                  }`}
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
                    {t(DONATION_PRESET_CAPTIONS[index] ?? 'donatePresetLocally')}
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
              aria-label={t('donateCustomAmount')}
              className="min-w-0 flex-1 bg-transparent text-sm leading-[1.5] text-[#0E203E] outline-none placeholder:text-[#0E203E]/45"
              inputMode="decimal"
              onChange={(event) => setCustom(event.target.value)}
              placeholder={t('donateCustomAmount')}
              value={custom}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-semibold uppercase leading-[1.4] tracking-[0.65px] text-[#414752]">
            {t('donatePaymentMethod')}
          </span>
          {/* Card is the only method the platform account accepts today. */}
          <div className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-[#2F7AD2] bg-[#FAFAFB] px-6 py-6">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold leading-[1.5] text-[#0E203E]">
              <CreditCardIcon style={{ fontSize: 14, color: '#2F7AD2' }} />
              {t('donatePaymentCard')}
            </span>
            <span className="inline-flex items-center gap-1 text-xs leading-[1.5] text-[#0B4497]">
              <span>Visa</span>
              <span aria-hidden="true" className="text-[#B0B6BF]">
                ·
              </span>
              <span>Mastercard</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <button
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-primary-600 bg-[#2F7AD2] px-5 py-3 text-base font-semibold leading-6 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit}
          onClick={onComplete}
          title={stripeReady ? undefined : t('donateNotReady')}
          type="button"
        >
          {t(monthly ? 'donateCompleteGiftMonthly' : 'donateCompleteGift', { amount: amountLabel })}
          <ArrowRightIcon aria-hidden style={{ fontSize: 16, color: '#FFFFFF' }} />
        </button>
        {!stripeReady && (
          <p className="text-xs leading-[1.5] text-neutral-600">{t('donateNotReady')}</p>
        )}
        {error && (
          <p aria-live="polite" className="text-xs leading-[1.5] text-danger-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs leading-[1.5] text-[#5C6370]">
            <ShieldCheckIcon style={{ fontSize: 12, color: '#2F7AD2' }} />
            {t('donateSecurity')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs leading-[1.5] text-[#5C6370]">
            <BuildingsIcon style={{ fontSize: 12, color: '#2F7AD2' }} />
            {t('donateTaxRelief')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs leading-[1.5] text-[#5C6370]">
            <RotateIcon style={{ fontSize: 12, color: '#2F7AD2' }} />
            {t('donateCancelAnytime')}
          </span>
        </div>
      </div>
    </section>
  )
}
