import { ReactNode } from 'react'

interface SectionCardProps {
  icon?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  headerClassName?: string
}

export function SectionCard({
  icon,
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = 'p-6',
  headerClassName = '',
}: SectionCardProps) {
  const hasHeader = Boolean(title || subtitle || action || icon)

  return (
    <section
      className={`rounded-2xl border border-[#DDE0E4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${className}`}
    >
      {hasHeader && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE0E4] p-4 sm:px-6 ${headerClassName}`}
        >
          <div className="flex items-center gap-3">
            {icon && <div className="shrink-0">{icon}</div>}
            <div>
              {typeof title === 'string' ? (
                <h2 className="text-xl font-semibold tracking-[-0.5px] text-[#0E203E] sm:text-2xl">
                  {title}
                </h2>
              ) : (
                title
              )}
              {subtitle && <p className="mt-0.5 text-sm text-[#5C6370] sm:text-base">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
