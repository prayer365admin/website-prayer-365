import LayoutIcon from '@/components/common/layout-icon'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import Image from 'next/image'

/*
 * "Coming soon" screen (NEXT_PUBLIC_IS_MAINTENANCE=true, reached at /maintenance).
 *
 * The whole product is paused, so this is a full-bleed brand panel rather than
 * the sign-in card: no header, no footer, no navigation — the screen IS the
 * page. The tone is forward-looking, not broken: one light source rises from a
 * horizon below the panel instead of a warning glow, and the only motion is a
 * single slow brand-blue pulse on the status. Server component with one plain
 * <a>: a click reloads, and the proxy answers straight back here until the
 * switch is off — that is "Check again".
 */
export default function ContentsSiteMaintenance({ locale }: { locale: SiteLocale }) {
  const t = siteT(locale)

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-primary-950 px-5 pb-[13vh] pt-14 sm:px-6">
      {/* The one light source: a horizon below the panel. Brightness grows
          toward it, so the page reads as "rising", not "down". */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46vh]"
        style={{
          background:
            'radial-gradient(72% 100% at 50% 100%, rgba(47,122,210,0.26), rgba(3,21,48,0) 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[86%] h-px"
        style={{
          background:
            'linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(65% 45% at 50% 42%, #000 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(65% 45% at 50% 42%, #000 0%, transparent 100%)',
        }}
      />

      <div className="relative w-full max-w-[560px] text-center">
        <div className="flex items-center justify-center gap-2.5">
          <Image
            alt=""
            className="h-9 w-9 object-contain"
            height={36}
            src="/images/logo-white.png"
            unoptimized
            width={36}
          />
          <span className="text-[17px] font-bold tracking-[-0.4px] text-white">
            {t('maintenanceEyebrow')}
          </span>
        </div>

        <div className="relative mt-9 rounded-3xl border border-white/10 bg-primary-900 p-7 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)] sm:p-10">
          {/* Hairline sheen along the top edge — depth without a second surface. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-0 h-px"
            style={{
              background:
                'linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))',
            }}
          />

          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <div aria-hidden className="absolute inset-0 rounded-2xl bg-primary-500/25 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/20 text-white ring-1 ring-inset ring-white/25">
              <LayoutIcon name="handsPraying" size={28} />
            </div>
          </div>

          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
            <span aria-hidden className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-300 opacity-60 [animation-duration:2.4s] motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-300" />
            </span>
            {t('maintenanceStatus')}
          </span>

          <h1 className="mt-4 text-balance font-font_heading text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-[44px]">
            {t('maintenanceTitle')}
          </h1>
          <p className="mx-auto mt-4 max-w-[430px] text-pretty text-[15px] leading-[1.65] text-white/70 sm:text-[17px]">
            {t('maintenanceBody')}
          </p>

          {/* Plain anchor on purpose: "Check again" must reload, and the proxy
              answers the reload until the switch is off. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-6 text-base font-semibold !text-primary-950 transition-colors duration-300 hover:bg-blue-100 hover:!text-primary-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto sm:px-8"
            href="/"
          >
            {t('maintenanceRetry')}
          </a>
        </div>
      </div>
    </main>
  )
}
