import { ReactNode } from 'react'

/** Small rounded badge ("Sanctuary Portal", "Sanctuary Bell Reminder", ...). */
export default function Pill({
  icon,
  children,
  className = '',
}: {
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-secondary_color/30 px-3 py-1 text-xs font-medium text-accent_color_2 ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}
