import { ReactNode } from 'react'

/**
 * Numbered section title of a sign-up step ("1 Personal & Baptismal Identity"),
 * with an optional badge on the right (e.g. the "Optional" pill on step 2).
 */
export default function StepHeader({
  step,
  title,
  badge,
}: {
  step: number
  title: string
  badge?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-3 font-font_heading text-2xl font-semibold tracking-tight text-primary-900">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-medium text-blue-800">
          {step}
        </span>
        {title}
      </h2>
      {badge}
    </div>
  )
}
