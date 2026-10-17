'use client'

import { useSiteI18n } from '@/i18n/site-i18n'
import { MobileChurchSummary, MobilePublicChurch } from '@/models/mobile'
import Link from 'next/link'
import { HOME_HABITS, homeCardThinShadowClassName } from './data'

const Ring = ({ value, goal, label }: { value: number; goal: number; label: string }) => {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  return (
    <div className="flex h-[125px] flex-col items-center justify-center rounded-xl bg-neutral-50 px-3 py-4">
      <div className="relative size-16">
        <svg aria-hidden="true" className="size-full rotate-180" viewBox="0 0 64 64">
          <circle
            className="stroke-neutral-200"
            cx="32"
            cy="32"
            fill="none"
            r={radius}
            strokeWidth="5"
          />
          <circle
            className="stroke-primary-500"
            cx="32"
            cy="32"
            fill="none"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - Math.min(value / goal, 1))}
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-primary-900">
          {value}
        </span>
      </div>
      <p className="mt-3 text-center text-sm text-primary-900">{label}</p>
    </div>
  )
}

/** Home section 3, right 1 (`home-3-right-1.png`): habit rings and followed churches. */
export default function SpiritualHabits({
  mainChurch,
  followedChurches,
}: {
  mainChurch: MobilePublicChurch | null
  followedChurches: MobileChurchSummary[]
}) {
  const { t } = useSiteI18n()
  const churches = [
    ...(mainChurch ? [{ id: mainChurch.id, name: mainChurch.name, city: null, isMain: true }] : []),
    ...followedChurches
      .filter((church) => church.id !== mainChurch?.id)
      .map((church) => ({ id: church.id, name: church.name, city: church.city, isMain: false })),
  ]

  return (
    <section aria-labelledby="home-habits-title" className={`p-4 ${homeCardThinShadowClassName}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-primary-900" id="home-habits-title">
          {t('homeHabitsTitle')}
        </h2>
        <span className="inline-flex h-6 items-center rounded-full bg-[#B9D8F8] px-2.5 text-xs text-blue-800">
          {t('homeHabitsStreak')}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Ring
          goal={HOME_HABITS.daysGoal}
          label={t('homeHabitsDays')}
          value={HOME_HABITS.daysInPrayer}
        />
        <Ring
          goal={HOME_HABITS.minutesGoal}
          label={t('homeHabitsMinutes')}
          value={HOME_HABITS.minutesThisWeek}
        />
      </div>

      <h3 className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-900">
        {t('homeHabitsFellowships')}
      </h3>
      {churches.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">{t('homeHabitsNone')}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {churches.slice(0, 3).map((church) => (
            <li key={church.id}>
              <Link
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-primary-900 transition hover:border-primary-300"
                href={`/churches/${church.id}`}
              >
                <span className="truncate">{church.name}</span>
                {church.isMain ? (
                  <span
                    aria-label={t('homeHabitsMain')}
                    className="size-2 shrink-0 rounded-full bg-blue-800"
                    role="img"
                  />
                ) : (
                  church.city && (
                    <span className="shrink-0 text-xs text-neutral-500">{church.city}</span>
                  )
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
