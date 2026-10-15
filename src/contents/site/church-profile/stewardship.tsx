'use client'

import { useState } from 'react'
import { SendOutlined } from '@ant-design/icons'
import { Input } from 'antd'
import { HandHeartIcon } from '@/components/icon/hand-heart'
import { useSiteI18n } from '@/i18n/site-i18n'

const PRESET_AMOUNTS = [10, 50, 100, 25]
interface StewardshipProps {
  churchName?: string
  denomination?: string
}

export function Stewardship({ churchName, denomination }: StewardshipProps) {
  const { t } = useSiteI18n()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(10)
  const [customAmount, setCustomAmount] = useState('')

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount)
    setCustomAmount('')
  }

  const handleCustomChange = (val: string) => {
    setCustomAmount(val)
    setSelectedAmount(null)
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#163B66] to-[#0E294A] text-white shadow-[0_12px_32px_-6px_rgba(11,68,151,0.2)]">
      {/* Header */}
      <div className="flex items-start gap-3.5 border-b border-white/15 p-4 sm:p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
          <HandHeartIcon className="text-2xl" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.3px] text-white">
            {t('parishStewardship')}
          </h2>
          <p className="text-xs text-white/80">{t('faithfulGiving')}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        <p className="mb-4 text-xs leading-relaxed text-white/85">
          {churchName
            ? `Support ${churchName}'s daily restoration of sacred heritage, community meals, and pastoral youth outreach.`
            : 'Support the daily restoration of the historic stained glass, crypt meals, and pastoral youth outreach.'}
        </p>

        {/* Amount presets (2x2 grid) */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          {PRESET_AMOUNTS.map((amt) => {
            const isSelected = selectedAmount === amt
            return (
              <button
                key={amt}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handlePresetClick(amt)}
                className={`flex h-[54px] items-center justify-center rounded-lg text-xl font-semibold transition-colors ${
                  isSelected
                    ? 'bg-white text-[#0E203E] shadow-sm'
                    : 'bg-white/15 text-white hover:bg-white/20'
                }`}
              >
                €{amt}
              </button>
            )
          })}
        </div>

        {/* Custom amount */}
        <div className="mb-3">
          <Input
            id="custom-amount"
            aria-label={t('customAmount')}
            prefix={<span className="mr-1 text-sm font-medium text-[#0E203E]">€</span>}
            placeholder="Or enter a custom amount"
            value={customAmount}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="h-12 rounded-lg border-none bg-white text-sm text-[#0E203E] shadow-sm placeholder:text-[#5C6370]"
          />
        </div>

        {/* CTA Button */}
        <div>
          <button
            type="button"
            disabled
            aria-label={t('donate')}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-semibold text-[#0E203E] shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed"
          >
            <SendOutlined className="text-base text-[#0E203E]" />
            <span>{t('giveViaBanklink')}</span>
          </button>
          <span className="sr-only">{t('donationsNotReady')}</span>
        </div>

        {/* Footer legal */}
        <p className="mt-4 text-center text-xs leading-relaxed text-[#D0E4FF]/75">
          {denomination
            ? `${denomination} is an accredited non-profit. Tax-deductible in EU/EEA.`
            : 'Estonian Evangelical Lutheran Church (EELK) is an accredited non-profit. Tax-deductible in EU/EEA.'}
        </p>
      </div>
    </div>
  )
}
