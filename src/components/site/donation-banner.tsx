import { HandHeartIcon } from '@/components/icon/hand-heart'
import Link from 'next/link'

/**
 * The website's standard giving ask. Every donation / stewardship banner on the
 * public site uses this navy card; only the copy and the link target change per
 * page. The home page's "my active gift" card is a different thing (it shows the
 * customer's own ledger) and stays separate.
 */
export function DonationBanner({
  body,
  ctaLabel,
  href,
  title,
  eyebrow,
}: {
  body: string
  ctaLabel: string
  href: string
  /** Optional heading, used where the banner carries its own title. */
  title?: string
  /** Optional small uppercase label above the title. */
  eyebrow?: string
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#163B66] to-[#0E294A] p-6 text-white shadow-[0_12px_32px_-6px_rgba(11,68,151,0.2)] sm:p-8">
      <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <HandHeartIcon className="text-2xl" />
          </div>
          <div className="max-w-xl">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                {eyebrow}
              </p>
            )}
            {title && <h2 className="text-xl font-semibold text-white">{title}</h2>}
            <p
              className={`text-sm leading-relaxed text-white/90 sm:text-base${title ? ' mt-1' : ''}`}
            >
              {body}
            </p>
          </div>
        </div>
        <Link
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-[#0E203E] shadow-sm transition-colors hover:bg-white/90 active:scale-95"
          href={href}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  )
}
