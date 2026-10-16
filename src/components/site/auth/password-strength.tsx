'use client'

import { useSiteI18n } from '@/i18n/site-i18n'

export type PasswordScore = 0 | 1 | 2 | 3 | 4

/**
 * 0 = empty. Any short password (< 8, the backend minimum) is 1. From 8
 * characters: one point each for length, mixed case, a digit, a symbol.
 */
export const scorePassword = (password: string): PasswordScore => {
  if (!password) return 0
  if (password.length < 8) return 1
  const checks = [
    true,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  return checks.filter(Boolean).length as PasswordScore
}

// Weak → strong: red, yellow, green, blue.
const SCORE_COLOR: Record<PasswordScore, string> = {
  0: '',
  1: 'bg-danger-500',
  2: 'bg-warning-500',
  3: 'bg-success-500',
  4: 'bg-primary-500',
}

/** 4-bar meter + "Key strength" label + length hint (WB1 sign-up step 1). */
export default function PasswordStrength({ password }: { password: string }) {
  const { t } = useSiteI18n()
  const score = scorePassword(password)
  const level = t(`passwordStrength${score}`)

  return (
    <div>
      <div
        aria-label={t('passwordStrength', { level })}
        aria-valuemax={4}
        aria-valuemin={0}
        aria-valuenow={score}
        className="grid grid-cols-4 gap-1"
        role="meter"
      >
        {[1, 2, 3, 4].map((bar) => (
          <span key={bar} className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            {/* Fill grows/shrinks bar by bar (staggered), colored by the current score. */}
            <span
              className={`block h-full rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none ${
                bar <= score ? `w-full ${SCORE_COLOR[score]}` : 'w-0'
              }`}
              style={{ transitionDelay: `${(bar - 1) * 75}ms` }}
            />
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between max-md:flex-col text-xs md:text-sm text-neutral-400">
        <span>{t('passwordStrength', { level })}</span>
        <span>{t('passwordHint')}</span>
      </div>
    </div>
  )
}
