import { MobileDeviceIcon } from '@/components/icon/mobile-device'
import { useSiteI18n } from '@/i18n/site-i18n'
import Image from 'next/image'

/**
 * "Prayer365 app is coming soon" card. Temporarily takes the place of WelcomeAppPromo
 * (kept on disk); keeps its `app-promo` id so the hero store badges still jump here.
 *
 * Responsive (no design exists, so these are defaults, see the handoff):
 * - xl (1280+): the desktop design, phones pinned to the card's right and bottom edge.
 * - lg (1024-1279): same side-by-side layout, phones stay 548px.
 * - below lg: stacked, text on top and the phones below, bottom-flush inside the card.
 */

// Blurred circles (handoff section B). The xl values are card-relative px fitted from the design
// PNG; lg scales them with the card width, and below lg they are placed by percentage, at the bottom so no glow sits behind the text (contrast).
// Painted bottom to top in this order; the gradients already fade out, so no blur filter.
const CIRCLES = [
  'bottom-[-60%] right-[-60%] size-[640px] bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-primary-300)_0%,transparent_100%)] lg:bottom-auto lg:left-[69%] lg:right-auto lg:top-[-96px] xl:left-[848px]',
  'bottom-[-40px] left-1/2 -ml-[139px] size-[278px] opacity-60 bg-[radial-gradient(50%_50%_at_50%_50%,white_0%,transparent_100%)] lg:bottom-auto lg:left-[86%] lg:top-[134px] lg:ml-0 xl:left-[986px]',
  'hidden size-[91px] opacity-60 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-donation-white-half)_0%,transparent_100%)] xl:left-[778px] xl:top-[153px] xl:block',
  'bottom-[-60%] left-[-40%] size-[640px] bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-donation-glow-deep)_0%,transparent_100%)] lg:bottom-auto lg:left-[-260px] lg:top-[-2px]',
]

export default function WelcomeComingSoon() {
  const { t } = useSiteI18n()

  return (
    <section
      aria-label={t('welcomeSoonSectionAria')}
      className="my-16 md:my-24 px-6 max-w-[1280px] mx-auto overflow-visible"
      id="app-promo"
    >
      <div className="relative flex flex-col rounded-3xl bg-primary-500 px-6 pt-8 text-white shadow-[0px_25px_50px_-12px_var(--color-donation-shadow)] md:px-10 md:pt-10 lg:h-[352px] lg:flex-row lg:items-center lg:p-0 lg:pl-12 xl:pl-16">
        {/* Clipped to the card; the phones below may still rise above it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
        >
          {CIRCLES.map((circle) => (
            <div className={`absolute ${circle}`} key={circle} />
          ))}
        </div>

        <div className="relative flex w-full flex-col items-start lg:w-[440px] xl:w-[560px]">
          <div className="mb-6 inline-flex items-center gap-1 rounded-full bg-white/25 px-4 py-1 text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-white">
            <MobileDeviceIcon aria-hidden style={{ fontSize: 14 }} />
            <span>{t('welcomeSoonBadge')}</span>
          </div>

          <h2 className="mb-6 text-balance text-[32px] font-bold leading-[1.15] tracking-[-1px] md:text-[38px] text-white">
            {t('welcomeSoonTitle')}
          </h2>

          <p className="font-font_text text-sm leading-[21px] text-white md:max-w-[520px] md:text-base md:leading-6 lg:max-w-[380px] xl:max-w-[430px]">
            {t('welcomeSoonBody')}
          </p>

          {/*
           * Notify form (K3), hidden for now. Needs a mail + bell icon (SVGs from design)
           * and a submit handler; full width up to 416px at every breakpoint; spec in .claude/spec/site/welcome/design-handoff.md.
           *
           * <form className="mt-6 flex h-12 w-full max-w-[416px] items-center justify-between rounded-xl border border-blue-200 bg-white/10 p-1">
           *   <MailIcon aria-hidden className="ml-2 text-white/60" />
           *   <input
           *     aria-label={t('welcomeSoonEmailLabel')}
           *     className="min-w-0 flex-1 bg-transparent px-3 font-font_text text-base text-white outline-none placeholder:text-white/60"
           *     placeholder={t('welcomeSoonEmailPlaceholder')}
           *     required
           *     type="email"
           *   />
           *   <button
           *     className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-150 py-0 pl-2 pr-3 font-font_text text-sm font-semibold text-primary-650"
           *     type="submit"
           *   >
           *     <BellIcon aria-hidden />
           *     {t('welcomeSoonNotify')}
           *   </button>
           * </form>
           */}
        </div>

        {/* Stacked: a wide, centre-cropped strip clipped by the card; lg+: `contents`, so the image is pinned to the card instead. */}
        <div className="-mx-6 mt-8 flex justify-center overflow-hidden rounded-b-3xl md:-mx-10 lg:contents">
          <Image
            alt={t('welcomeSoonPhonesAlt')}
            className="pointer-events-none relative h-auto w-[400px] max-w-none shrink-0 md:w-[640px] lg:absolute lg:bottom-0 lg:right-0 lg:w-[548px]"
            height={396}
            src="/images/phone-frame.png"
            unoptimized
            width={548}
          />
        </div>
      </div>
    </section>
  )
}
