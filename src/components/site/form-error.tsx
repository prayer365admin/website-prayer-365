import { ReactNode } from 'react'

/** General (not field-level) form error, announced to screen readers. */
export default function FormError({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={`rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 !text-xs text-danger-700 !md:text-sm ${className}`}
      role="alert"
    >
      {children}
    </p>
  )
}
