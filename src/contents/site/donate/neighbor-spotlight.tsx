'use client'

import { QuoteIcon } from '@/components/icon/quote'
import { SparklesIcon } from '@/components/icon/sparkles'
import { useSiteI18n } from '@/i18n/site-i18n'
import { DonateNeighborSpotlight } from '@/models/donation'
import Image from 'next/image'
import Link from 'next/link'

/**
 * W11 spotlight: a real neighbouring parish and one of its published prayers.
 * The thumbnail and the parish name both open that church's profile.
 */
export function NeighborSpotlight({ neighbor }: { neighbor: DonateNeighborSpotlight }) {
  const { locale, t } = useSiteI18n()
  const href = `/churches/${neighbor.slug}`

  return (
    <section
      aria-labelledby="donate-spotlight-title"
      className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#B9D8F8] px-4 py-1 text-xs leading-[1.5] text-[#0B4497]">
        <SparklesIcon style={{ fontSize: 12, color: '#0B4497' }} />
        {t('donateNeighborPill')}
      </span>

      {neighbor.coverUrl && (
        <Link className="relative block h-[176px] w-full overflow-hidden rounded-lg" href={href}>
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(min-width: 1024px) 430px, 100vw"
            src={neighbor.coverUrl}
            unoptimized
          />
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to top, rgba(45,49,51,0.8) 0%, rgba(45,49,51,0) 50%, rgba(45,49,51,0) 100%)',
            }}
          />
          {neighbor.distanceKm !== null && (
            <span className="absolute bottom-2 left-2 right-2 text-xs leading-[1.5] text-white">
              {t('donateNeighborDistance', {
                distance: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                  neighbor.distanceKm,
                ),
              })}
            </span>
          )}
        </Link>
      )}

      <div className="flex flex-col gap-1.5">
        <h2
          className="font-font_heading text-xl font-semibold leading-[1.5] text-[#0E203E]"
          id="donate-spotlight-title"
        >
          <Link className="underline-offset-2 hover:underline" href={href}>
            {neighbor.churchName}
          </Link>
        </h2>
        <p className="text-sm leading-[1.5] text-[#5C6370]">{neighbor.prayer.title}</p>
      </div>

      <figure className="rounded-lg bg-[#F2F4F6] p-4">
        <QuoteIcon aria-hidden style={{ fontSize: 16, color: '#2F7AD2' }} />
        <blockquote className="mt-1 line-clamp-6 font-font_quote text-2xl italic leading-[1.3] text-[#0B4497]">
          {neighbor.prayer.body}
        </blockquote>
        <figcaption className="mt-2">
          <span className="block text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#5C6370]">
            {neighbor.prayer.pastorName}
          </span>
          <span className="block text-xs font-medium leading-4 text-[#414752]">
            {neighbor.prayer.churchName}
          </span>
        </figcaption>
      </figure>
    </section>
  )
}
