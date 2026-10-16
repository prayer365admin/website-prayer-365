import { BellRingIcon } from '@/components/icon/bell-ring'
import { GuardIcon } from '@/components/icon/guard'
import { OutlinedLogoIcon } from '@/components/icon/outlined-logo'
import { SoundWaveIcon } from '@/components/icon/sound-wave'
import { SunIcon } from '@/components/icon/sun'
import { SiteT } from '@/i18n/messages'
import { CaretRightFilled, UserOutlined } from '@/components/icon/antd-icons'
import Pill from './pill'

/*
 * Sign-in side panels (WB1 design). Content is HARDCODED for now (decision F2,
 * REPORT R-05): no live stream, player, reminder or stats exist yet, so the
 * player is decorative, not a button.
 *
 * Server component (no client JS): the page passes `t` from siteT(locale).
 */
export default function SignInAside({ t }: { t: SiteT }) {
  return (
    <>
      {/* overlay-navy tint layered over the banner image (WB1 design). */}
      <section className="rounded-2xl bg-[image:linear-gradient(var(--color-overlay-navy),var(--color-overlay-navy)),url('/images/sanctuary-banner.webp')] bg-cover bg-center p-6 text-white shadow-[0px_12px_32px_-6px_#0B449733]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em]">
            <span aria-hidden className="h-2 w-2 rounded-full bg-white" />
            {t('liveStreamLabel')}
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <SunIcon aria-hidden className="!text-white" style={{ fontSize: 20 }} />
          </span>
        </div>

        <div className="py-4 flex flex-col items-center text-center">
          <OutlinedLogoIcon aria-hidden className="!text-white" style={{ fontSize: 80 }} />
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/80">
            {t('liveWhisperLabel')}
          </p>
          <h2 className="font-font_quote text-3xl leading-tight md:text-[32px]">
            {t('liveWhisperTitle')}
          </h2>
          <p className="mt-3 text-xs text-white/80">{t('liveWhisperMembers')}</p>
        </div>

        <div aria-hidden className="mt-4 flex items-center gap-[45px] rounded-xl bg-white/10 p-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-800">
              <CaretRightFilled />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{t('livePlayerTitle')}</p>
              <p className="truncate text-xs text-white/80">{t('livePlayerSubtitle')}</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs uppercase">
            <SoundWaveIcon aria-hidden className="!text-blue-100" style={{ fontSize: 15 }} />
            {t('livePlayerBadge')}
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
        <div className="flex items-center justify-between gap-2">
          <Pill icon={<BellRingIcon aria-hidden />}>{t('bellPill')}</Pill>
          <span className="text-xs text-neutral-500">{t('bellTime')}</span>
        </div>
        <p className="mt-4 text-sm text-neutral-600">{t('bellBody')}</p>
        <div className="mt-4 flex items-center gap-3 text-sm text-neutral-700">
          {/* 24px circles, 8px overlap, 2px white ring (placeholder pastor photos, REPORT R-05). */}
          <span aria-hidden className="flex">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-800 text-xs text-white shadow-[0px_0px_0px_2px_#FFFFFF] [&:not(:first-child)]:-ms-2"
              >
                <UserOutlined />
              </span>
            ))}
          </span>
          <span className="text-sm font-medium text-primary-950">{t('bellPastors')}</span>
        </div>
      </section>

      {/* Design gradient drawn over white (gradient layer on top so it shows). */}
      <section className="flex gap-4 rounded-2xl bg-white bg-[image:linear-gradient(135deg,var(--color-blue-tint)_0%,rgba(255,255,255,0)_100%)] p-5 shadow-[0_8px_30px_rgba(15,40,80,0.06)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100">
          {/* Design: 16px glyph in a 20px line box, primary-500. */}
          <GuardIcon
            aria-hidden
            className="!text-primary-500"
            style={{ fontSize: 20, lineHeight: '20px' }}
          />
        </span>
        <div>
          <p className="text-lg font-semibold text-primary-950">{t('sealTitle')}</p>
          <p className="text-sm mt-1 text-neutral-600">{t('sealBody')}</p>
        </div>
      </section>
    </>
  )
}
