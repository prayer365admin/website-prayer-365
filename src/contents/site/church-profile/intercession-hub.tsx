'use client'

import type { SyntheticEvent } from 'react'
import { useState } from 'react'
import { SendOutlined } from '@ant-design/icons'
import { Alert, Checkbox, Input } from 'antd'
import axios from 'axios'
import { HandHeartIcon } from '@/components/icon/hand-heart'
import { useSiteI18n } from '@/i18n/site-i18n'

interface IntercessionHubProps {
  churchId?: string
  churchName?: string
}

export function IntercessionHub({ churchId, churchName }: IntercessionHubProps) {
  const { t } = useSiteI18n()
  const [name, setName] = useState('')
  const [prayer, setPrayer] = useState('')
  const [confidential, setConfidential] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    if (!prayer.trim()) return
    setErrorMsg(null)
    setSubmitting(true)
    try {
      if (churchId) {
        await axios.post(`/api/v1/site/churches/${churchId}/requests`, {
          kind: 'prayer',
          subject: name.trim() ? `Prayer for ${name.trim()}` : 'Prayer petition',
          message: prayer.trim(),
          classification: confidential ? 'PRIVATE' : 'STANDARD',
          contactMethod: 'in_app',
        })
      }
      setSubmitted(true)
      setName('')
      setPrayer('')
    } catch {
      setErrorMsg('Failed to submit prayer petition. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <section className="rounded-2xl border border-[#DDE0E4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      {/* Header */}
      <div className="flex items-center gap-3.5 border-b border-[#DDE0E4] p-4 sm:p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6EDFB] text-[#2F7AD2]">
          <HandHeartIcon className="text-2xl" />
        </div>
        <h2 className="text-lg font-semibold tracking-[-0.3px] text-[#0E203E] sm:text-xl">
          {t('parishIntercessionHub')}
        </h2>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        <p className="mb-4 text-xs sm:text-sm leading-relaxed text-[#5C6370]">
          {churchName
            ? `Requests are placed upon the ${churchName} altar and remembered by name in our daily 12:00 midday prayer and Wednesday Taizé vigil.`
            : t('intercessionIntro')}
        </p>
        {errorMsg && <Alert type="error" message={errorMsg} showIcon className="mb-4" />}

        {submitted && (
          <Alert type="success" message={t('prayerSubmitted')} showIcon className="mb-4" />
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="prayer-name"
              className="mb-1 block text-xs font-semibold text-[#393E46]"
            >
              {t('yourName')}
            </label>
            <Input
              id="prayer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="h-9 rounded border-[#DDE0E4] text-xs placeholder:text-[#5C6370]/45"
            />
          </div>

          <div>
            <label
              htmlFor="prayer-content"
              className="mb-1 block text-xs font-semibold text-[#393E46]"
            >
              {t('yourPrayer')}
            </label>
            <Input
              id="prayer-content"
              value={prayer}
              onChange={(e) => setPrayer(e.target.value)}
              placeholder={t('prayerPlaceholder')}
              className="h-9 rounded border-[#DDE0E4] text-xs placeholder:text-[#5C6370]/45"
            />
          </div>

          <div>
            <Checkbox
              checked={confidential}
              onChange={(e) => setConfidential(e.target.checked)}
              className="text-sm text-[#5C6370]"
            >
              {t('keepConfidential')}
            </Checkbox>
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-label={t('offerPrayer')}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2F7AD2] px-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#2568B8] disabled:opacity-70"
          >
            <SendOutlined className="text-base" />
            <span>{submitting ? 'Submitting...' : t('offerPrayer')}</span>
          </button>
        </form>
      </div>
    </section>
  )
}
