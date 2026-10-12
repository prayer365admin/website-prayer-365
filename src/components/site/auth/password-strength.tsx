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
          <span
            key={bar}
            className={`h-1.5 rounded-full ${bar <= score ? 'bg-primary_color' : 'bg-[#e6ebf2]'}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-sm text-gray-500">
        <span>{t('passwordStrength', { level })}</span>
        <span>{t('passwordHint')}</span>
      </div>
    </div>
  )
}
