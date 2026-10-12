import { ReactNode } from 'react'

/** White rounded card; each AuthCardSection is split from the next by a divider (WB1 design). */
export function AuthCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`divide-y divide-[#e6ebf2] overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(15,40,80,0.06)] ${className}`}
    >
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
  return <div className={`px-6 py-6 md:px-8 ${className}`}>{children}</div>
}
