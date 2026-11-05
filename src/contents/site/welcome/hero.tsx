import { AppleIcon } from '@/components/icon/apple'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { GoogleIcon } from '@/components/icon/google'
import { LockIcon } from '@/components/icon/lock'
import { SparklesIcon } from '@/components/icon/sparkles'
import { WaveformIcon } from '@/components/icon/waveform'
import { StarFilled } from '@/components/icon/antd-icons'
import { SiteLocale } from '@/config/site-locale'
import { SiteT } from '@/i18n/messages'
import { SiteLoginPrayer } from '@/models/site-prayer'
import Image from 'next/image'
import Link from 'next/link'
import { PASTOR_AVATARS } from './data'
import WelcomePrayerPlayer from './prayer-player'
export default function WelcomeHero({
  locale = 'en',
  memberCount = null,
  prayer = null,
  t,
}: {
  locale?: SiteLocale
  memberCount?: number | null
  prayer?: SiteLoginPrayer | null
  t: SiteT
}) {
  const believersLabel =
    typeof memberCount === 'number'
      ? `${new Intl.NumberFormat(locale).format(memberCount)} Believers`
      : t('welcomeStatsUnavailable')
  // The hero badges always jump to the app promo section; the store links live there
  // (and in the QR code) because the app ships to both stores.
  const appDownloadHref = '#app-promo'

  return (
    <section
      aria-label="Welcome Hero"
      className="relative flex min-h-[calc(100vh-64px)] items-center bg-[linear-gradient(110.95deg,#0E203E_0%,#1B2123_100%)] px-6 py-14 text-white overflow-hidden"
    >
      {/* Hero background: the cover of the church behind the newest prayer, faded into the hero blue */}
      <Image
        alt={prayer ? `${prayer.churchName} sanctuary` : 'Sanctuary interior'}
        className="object-cover"
        fill
        priority
        sizes="100vw"
        src={prayer?.churchCoverUrl ?? '/images/church.jpeg'}
        unoptimized
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(105deg,rgba(14,32,62,0.94)_0%,rgba(14,32,62,0.72)_45%,rgba(14,32,62,0.5)_100%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col">
        <div className="grid lg:grid-cols-[662fr_466fr] gap-8 items-center">
          {/* Left Column */}
          <div className="flex flex-col justify-center">
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1 w-fit mb-6 border border-white/10">
              <SparklesIcon aria-hidden className="text-white" style={{ fontSize: 12 }} />
              <span className="text-[12px] font-medium text-white tracking-wide">
                Ecumenical Fellowship &amp; Daily Liturgy
              </span>
            </div>

            {/* H1 Heading */}
            <h1 className="tracking-normal">
              <span className="block font-font_quote italic font-normal text-[48px] md:text-[56px] leading-[1.1] text-white">
                Everyday Faith.
              </span>
              <span className="block font-font_heading font-bold text-[32px] md:text-[36px] leading-tight tracking-[-1px] text-white mt-4">
                A More Connected Tomorrow.
              </span>
            </h1>

            {/* Body Paragraph */}
            <p className="mt-6 text-[16px] leading-[24px] text-[#DDE0E4] max-w-[662px]">
              Uniting Baltic parish communities through daily liturgical prayer, confidential
              pastoral care, and open intercession across traditions.
            </p>

            {/* Primary Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <Link
                className="h-14 rounded-xl bg-[#2F7AD2] text-white text-[16px] font-semibold px-6 flex items-center gap-2 hover:bg-[#256bb8] transition-colors shadow-sm"
                href="/register"
              >
                <span>Join the Sanctuary — Register Free</span>
                <ArrowRightIcon aria-hidden style={{ fontSize: 16 }} />
              </Link>

              <Link
                className="h-14 rounded-xl border border-white text-white text-[16px] font-semibold px-5 flex items-center gap-2 hover:bg-white/10 transition-colors"
                href="/login"
              >
                <LockIcon aria-hidden style={{ fontSize: 16 }} />
                <span>Sign In to Portal</span>
              </Link>
            </div>

            {/* App Store Badges */}
            <div className="mt-6 flex flex-wrap gap-4">
              <a
                aria-label="Download on the App Store"
                className="h-[51px] rounded-xl bg-black/85 border border-white/20 flex items-center gap-3 px-4 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] hover:bg-black transition-colors"
                href={appDownloadHref}
              >
                <AppleIcon aria-hidden className="text-white" style={{ fontSize: 26 }} />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] tracking-[2px] uppercase text-[#CBD5E1] font-semibold leading-none">
                    Download on the
                  </span>
                  <span className="text-[13px] text-white font-semibold leading-tight mt-0.5">
                    App Store
                  </span>
                </div>
              </a>

              <a
                aria-label="Get it on Google Play"
                className="h-[51px] rounded-xl bg-black/85 border border-white/20 flex items-center gap-3 px-4 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] hover:bg-black transition-colors"
                href={appDownloadHref}
              >
                <GoogleIcon aria-hidden style={{ fontSize: 22 }} />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] tracking-[2px] uppercase text-[#CBD5E1] font-semibold leading-none">
                    Get it on
                  </span>
                  <span className="text-[13px] text-white font-semibold leading-tight mt-0.5">
                    Google Play
                  </span>
                </div>
              </a>
            </div>

            {/* Trust Row */}
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-[#B9D8F8]">
              <div
                className="flex items-center gap-0.5 mr-1"
                role="img"
                aria-label="5 stars rating"
              >
                {[...Array(5)].map((_, i) => (
                  <StarFilled className="!text-[#FCD34D] text-[13px]" key={i} />
                ))}
              </div>
              <span className="font-medium text-[#FCD34D]">4.9 ★ Ecumenical Rating</span>
              <span aria-hidden className="text-[#94A3B8]">
                •
              </span>
              <span>Available free on iOS &amp; Android</span>
              <span aria-hidden className="text-[#94A3B8]">
                •
              </span>
              <span>Sacred space, zero advertisements</span>
            </div>
          </div>

          {/* Right Column / Live Prayer + Audio Card */}
          <div className="relative flex w-full flex-col justify-end gap-8 overflow-hidden rounded-2xl bg-[rgba(9,20,38,0.45)] p-4 backdrop-blur-[2px]">
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_top,rgba(14,32,62,0.6)_0%,rgba(14,32,62,0.25)_50%,rgba(14,32,62,0)_100%)]"
            />

            <div className="relative z-10 flex w-full flex-col gap-2">
              {/* Frosted Stat Card */}
              <div className="flex w-full items-center gap-3 rounded-xl bg-black/20 p-2 backdrop-blur-[8px]">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.08] text-white">
                  <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 15 12" width="15">
                    <path
                      d="M8.0625 0.5625V1.125H8.8125H9.375V2.25H8.8125H8.0625V3.35156L11.25 5.25V12H9V9.75C9 8.92969 8.32031 8.25 7.5 8.25C6.65625 8.25 6 8.92969 6 9.75V12H3.75V5.25L6.9375 3.35156V2.25H6.1875H5.625V1.125H6.1875H6.9375V0.5625V0H8.0625V0.5625ZM0 8.0625L3 6.42188V12H0V8.0625ZM15 12H12V6.42188L15 8.0625V12Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className="flex min-w-0 flex-col py-0.5">
                  <span className="text-[14px] font-semibold leading-[1.5] text-white">
                    {believersLabel}
                  </span>
                  <span className="truncate text-[12px] leading-[1.5] text-white">
                    United in prayer today across 42 Baltic parishes
                  </span>
                </div>
              </div>

              {/* Featured Daily Audio Prayer Card */}
              <div className="flex w-full flex-col gap-6 rounded-2xl bg-[linear-gradient(150.55deg,#C2D9FF_0%,#FFFFFF_100%)] p-4 text-[#191C1E]">
                <div className="flex w-full flex-col gap-4">
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <WaveformIcon
                          aria-hidden
                          className="text-[#2F7AD2]"
                          style={{ fontSize: 12 }}
                        />
                        <span className="text-[10px] font-semibold uppercase leading-[1.5] tracking-[2px] text-[#2F7AD2]">
                          Guided Contemplation
                        </span>
                      </div>

                      <h2 className="pt-0.5 text-[16px] font-semibold leading-[1.5] text-[#0E203E]">
                        {prayer ? prayer.title : t('welcomeNoOpenPrayer')}
                      </h2>

                      <div className="flex items-center gap-2 text-[12px] leading-[1.5] text-[#5C6370]">
                        {prayer ? (
                          <>
                            <span className="truncate">{prayer.pastorName}</span>
                            <span
                              aria-hidden
                              className="h-[3px] w-[3px] shrink-0 rounded-full bg-[#B0B6BF]"
                            />
                            <span className="truncate">{prayer.churchName}</span>
                          </>
                        ) : (
                          <span>{t('welcomeStatsUnavailable')}</span>
                        )}
                      </div>
                    </div>

                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#DDE0E4] bg-white text-[#2555A7]"
                    >
                      <svg fill="none" height="14" viewBox="0 0 12 14" width="12">
                        <path
                          d="M1 1.75C1 1.33579 1.33579 1 1.75 1H10.25C10.6642 1 11 1.33579 11 1.75V12.75C11 12.9541 10.7865 13.082 10.6113 12.9806L6 10.3194L1.38866 12.9806C1.21349 13.082 1 12.9541 1 12.75V1.75Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <path d="M6 3.5V8M3.75 5.75H8.25" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                    </span>
                  </div>

                  {prayer?.introduction && (
                    <p className="w-full text-[12px] leading-[1.5] text-[#737C8C]">
                      &ldquo;{prayer.introduction}&rdquo;
                    </p>
                  )}
                </div>

                <WelcomePrayerPlayer
                  audioUrl={prayer?.audioUrl ?? null}
                  title={prayer?.title ?? ''}
                />
              </div>

              {/* Pastors Online for Prayer Row */}
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex items-center">
                    {PASTOR_AVATARS.map((avatar, idx) => (
                      <Image
                        alt="Pastor online"
                        className="-mr-3 h-6 w-6 rounded-full object-cover ring-2 ring-white last:mr-0"
                        height={24}
                        key={idx}
                        src={avatar}
                        unoptimized
                        width={24}
                      />
                    ))}
                  </div>
                  <span className="truncate text-[10px] font-medium leading-none text-white/45">
                    Pastors online for prayer
                  </span>
                </div>

                <Link
                  className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-semibold leading-[1.5] text-white transition-colors hover:text-white/80"
                  href="/login"
                >
                  <span>Request Prayer</span>
                  <ArrowRightIcon aria-hidden style={{ fontSize: 12 }} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
