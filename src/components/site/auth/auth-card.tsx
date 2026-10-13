import { ReactNode } from 'react'

/** White rounded card. Sections stack with no lines between them; add a border on a section where the design shows one. */
export function AuthCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-xl bg-white shadow-sm ${className}`}>
      {children}
    </section>
  )
}

export function AuthCardSection({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`px-6 py-6 md:py-8 md:px-8 ${className}`}>{children}</div>
}
