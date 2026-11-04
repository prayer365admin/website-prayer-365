import { AppleIcon } from '@/components/icon/apple'
import { BellOutlined, CheckOutlined, HeartOutlined } from '@/components/icon/antd-icons'
import { BellRingIcon } from '@/components/icon/bell-ring'
import { GoogleIcon } from '@/components/icon/google'
import { APP_FEATURES } from './data'
import { QRCode } from 'antd'
import Image from 'next/image'

const FEATURE_ICONS = [
  <BellRingIcon aria-hidden key="bell-ring" style={{ fontSize: 16 }} />,
  <CheckOutlined aria-hidden key="check" style={{ fontSize: 14 }} />,
  <BellOutlined aria-hidden key="bell" style={{ fontSize: 16 }} />,
  <HeartOutlined aria-hidden key="heart" style={{ fontSize: 16 }} />,
]

export default function WelcomeAppPromo() {
  const appStoreUrl =
    process.env.NEXT_PUBLIC_APP_STORE_URL ||
    process.env.NEXT_PUBLIC_IOS_APP_URL ||
    'https://apps.apple.com/app/prayer-365'

  const playStoreUrl =
    process.env.NEXT_PUBLIC_PLAY_STORE_URL ||
    process.env.NEXT_PUBLIC_ANDROID_APP_URL ||
    'https://play.google.com/store/apps/details?id=com.prayer365'

  const qrCodeUrl = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL || appStoreUrl || playStoreUrl

  return (
    <section
      aria-label="Mobile Sanctuary for iOS and Android"
      className="py-16 md:py-20 px-6 max-w-[1280px] mx-auto overflow-visible"
      id="app-promo"
    >
      <div className="relative rounded-[32px] p-6 sm:p-8 md:p-12 lg:p-16 pb-0 md:pb-0 lg:pb-0 bg-[linear-gradient(135deg,#0B4497_0%,#2F7AD2_50%,#204B92_100%)] shadow-[0px_20px_50px_rgba(0,92,173,0.32)] text-white grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        {/* Left Column */}
        <div className="flex flex-col justify-center pb-8 md:pb-12 lg:col-span-7 lg:pb-16">
          <div className="rounded-full bg-white/15 px-3.5 py-1 w-fit text-white text-[11px] font-semibold tracking-wider uppercase mb-5 border border-white/20 flex items-center gap-2">
            <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 10 14" width="10">
              <rect
                height="12.5"
                rx="1.75"
                stroke="currentColor"
                strokeWidth="1.5"
                width="8.5"
                x="0.75"
                y="0.75"
              />
              <circle cx="5" cy="10.5" fill="currentColor" r="0.75" />
            </svg>
            <span>Mobile Sanctuary for iOS &amp; Android</span>
          </div>

          <h2 className="text-[32px] sm:text-[38px] lg:text-[42px] font-bold leading-[1.15] tracking-[-1px] text-white mb-4">
            Take the Sanctuary Wherever You Walk
          </h2>

          <p className="text-[15px] sm:text-[16px] text-white/85 mb-8 leading-relaxed max-w-[540px]">
            Carry the silence of the nave, the comfort of daily scripture, and immediate pastoral
            care with you on morning commutes, forest strolls, and peaceful bedtimes.
          </p>

          {/* 4 Feature Bullets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mb-8">
            {APP_FEATURES.map((feature, i) => (
              <div className="flex items-start gap-3" key={feature.title}>
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0 border border-white/10 text-white mt-0.5">
                  {FEATURE_ICONS[i]}
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] sm:text-[15px] font-semibold text-white leading-snug">
                    {feature.title}
                  </span>
                  <span className="text-[12px] text-[#C2D9FF] mt-0.5 leading-snug">
                    {feature.hint}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* App Badges */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <a
              aria-label="Download on the App Store"
              className="flex h-[51px] w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-black/85 px-4 shadow-md transition-colors hover:bg-black sm:w-auto"
              href={appStoreUrl}
              rel="noopener noreferrer"
              target="_blank"
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
              className="flex h-[51px] w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-black/85 px-4 shadow-md transition-colors hover:bg-black sm:w-auto"
              href={playStoreUrl}
              rel="noopener noreferrer"
              target="_blank"
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
        </div>

        {/* Right Column: phone clipped by the card edge, QR card floating over it */}
        <div className="relative h-[300px] w-full overflow-hidden sm:h-[400px] lg:col-span-5 lg:h-full lg:min-h-[500px]">
          <div className="pointer-events-none absolute left-1/2 top-0 w-[220px] -translate-x-1/2 sm:w-[280px] lg:left-auto lg:right-6 lg:w-[360px] lg:translate-x-0">
            <Image
              alt="Prayer 365 Mobile App Screen"
              className="h-auto w-full drop-shadow-2xl"
              height={1958}
              priority
              src="/images/phone-landing.png"
              unoptimized
              width={967}
            />
          </div>

          {/* QR card: desktop only — a phone cannot scan its own screen */}
          <div className="absolute right-0 bottom-6 z-20 hidden w-[160px] flex-col items-center rounded-2xl bg-white p-3.5 text-center text-[#191C1E] shadow-2xl lg:flex">
            <div className="rounded-lg bg-white p-1">
              <QRCode
                bordered={false}
                color="#005CAD"
                errorLevel="M"
                size={105}
                value={qrCodeUrl}
              />
            </div>

            <span className="mt-2 text-[13px] font-bold text-[#0E203E]">Scan on Camera</span>
            <span className="mt-0.5 text-[11px] font-medium leading-snug text-[#5C6370]">
              Direct app download for iOS &amp; Android
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
