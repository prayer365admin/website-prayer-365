'use client'

import { useSiteI18n } from '@/i18n/site-i18n'

/**
 * `(site)` error boundary. Pages in this group read the database before they
 * return HTML, so a real fault (database down, pool exhausted, bad config) used
 * to be swallowed by the donate page and reported as "church not found". It now
 * lands here: one clear line and a retry, while Next still logs the server-side
 * error for the deploy logs.
 */
export default function SiteError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useSiteI18n()

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <p className="text-base text-slate-700">{t('error')}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-[#163B66] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0E294A]"
      >
        {t('errorRetry')}
      </button>
    </div>
  )
}
