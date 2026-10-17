'use client'

import MaskIcon from '@/components/site/mask-icon'
import { useSubmitRequest } from '@/hooks/data/site/request'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobilePublicChurch } from '@/models/mobile'
import { SendOutlined } from '@ant-design/icons'
import axios from 'axios'
import { FormEvent, useState } from 'react'
import { PETITION_INTENTIONS, homeCardThinShadowClassName } from './data'

/** Home section 3, right 2 (`home-3-right-2.png`): prayer request to the main church. */
export default function PrayerPetition({ church }: { church: MobilePublicChurch | null }) {
  const { t } = useSiteI18n()
  const { onSubmit, submitting } = useSubmitRequest()
  const [intention, setIntention] = useState(PETITION_INTENTIONS[0])
  const [message, setMessage] = useState('')
  const [confidential, setConfidential] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!church || !message.trim()) return
    try {
      await onSubmit({
        churchId: church.id,
        input: {
          kind: 'prayer',
          subject: t(intention),
          message: message.trim(),
          classification: confidential ? 'PRIVATE' : 'STANDARD',
          contactMethod: 'in_app',
        },
      })
      setMessage('')
      setConfidential(false)
      setStatus({ ok: true, text: t('homePetitionSent', { church: church.name }) })
    } catch (error) {
      const limited = axios.isAxiosError(error) && error.response?.status === 429
      setStatus({ ok: false, text: t(limited ? 'homePetitionRateLimited' : 'homePetitionError') })
    }
  }

  return (
    <section
      aria-labelledby="home-petition-title"
      className={homeCardThinShadowClassName}
      id="prayer-petition"
    >
      <div className="flex items-center gap-3 border-b border-neutral-200 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <MaskIcon className="bg-primary-500" size={20} src="/icons/icon-Interceding.svg" />
        </span>
        <div>
          <h2
            className="text-xl font-semibold leading-[1.5] tracking-normal text-primary-900"
            id="home-petition-title"
          >
            {t('homePetitionTitle')}
          </h2>
          <p className="text-xs leading-[1.5] tracking-normal text-neutral-600">
            {t('homePetitionBody')}
          </p>
        </div>
      </div>

      <form className="p-4" onSubmit={submit}>
        <fieldset disabled={!church || submitting}>
          <legend className="text-sm text-primary-900">{t('homePetitionFocus')}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PETITION_INTENTIONS.map((key) => (
              <button
                aria-pressed={intention === key}
                className={`h-9 rounded-lg px-2 text-xs font-medium transition ${
                  intention === key
                    ? 'bg-primary-500 text-white'
                    : 'bg-blue-50 text-blue-800 hover:bg-primary-300/30'
                }`}
                key={key}
                onClick={() => setIntention(key)}
                type="button"
              >
                {t(key)}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-sm text-primary-900" htmlFor="home-petition-message">
            {t('homePetitionRequest')}
          </label>
          <textarea
            className="mt-2 block w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm text-primary-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none disabled:bg-neutral-50"
            id="home-petition-message"
            maxLength={10000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('homePetitionPlaceholder')}
            required
            rows={3}
            value={message}
          />

          <label className="mt-4 flex items-center gap-2 text-sm text-neutral-700">
            <input
              checked={confidential}
              className="size-4 rounded accent-primary-500"
              onChange={(event) => setConfidential(event.target.checked)}
              type="checkbox"
            />
            {t('homePetitionConfidential')}
          </label>

          <button
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!message.trim()}
            type="submit"
          >
            <SendOutlined className="-rotate-45" /> {t('homePetitionSend')}
          </button>
        </fieldset>

        <p
          aria-live="polite"
          className={`mt-3 text-center text-xs ${
            !church || status
              ? status?.ok
                ? 'text-success-500'
                : 'text-danger-500'
              : 'text-neutral-600'
          }`}
        >
          {!church ? (
            t('homePetitionNoChurch')
          ) : status ? (
            status.text
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <MaskIcon className="bg-primary-500" size={14} src="/icons/Icon-guard.svg" />
              {t('homePetitionProtected')}
            </span>
          )}
        </p>
      </form>
    </section>
  )
}
