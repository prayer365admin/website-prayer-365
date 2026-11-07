import { AngleRightIcon } from '@/components/icon/angle-right'
import { CheckOutlined } from '@/components/icon/antd-icons'
import { CalendarClockIcon } from '@/components/icon/calendar-clock'
import { GivingIcon } from '@/components/icon/giving'
import { HandHeartIcon } from '@/components/icon/hand-heart'
import { LockIcon } from '@/components/icon/lock'
import { ShieldCheckIcon } from '@/components/icon/shield-check'
import { SoundWaveIcon } from '@/components/icon/sound-wave'
import { useSiteI18n } from '@/i18n/site-i18n'
import Image from 'next/image'
import { LITURGY_SCHEDULE_BLOCKS } from './data'

const ChurchSvg = () => (
  <svg
    aria-hidden="true"
    className="shrink-0"
    fill="none"
    height="12"
    viewBox="0 0 15 12"
    width="15"
  >
    <path
      d="M8.0625 0.5625V1.125H8.8125H9.375V2.25H8.8125H8.0625V3.35156L11.25 5.25V12H9V9.75C9 8.92969 8.32031 8.25 7.5 8.25C6.65625 8.25 6 8.92969 6 9.75V12H3.75V5.25L6.9375 3.35156V2.25H6.1875H5.625V1.125H6.1875H6.9375V0.5625V0H8.0625V0.5625ZM0 8.0625L3 6.42188V12H0V8.0625ZM15 12H12V6.42188L15 8.0625V12Z"
      fill="#0B4497"
    />
  </svg>
)

export default function WelcomePillars() {
  const { t } = useSiteI18n()

  return (
    <section
      aria-label={t('welcomePillarsTitle')}
      className="py-16 md:py-24 px-6 max-w-[1280px] mx-auto"
      id="pillars"
    >
      {/* Centered Section Header */}
      <div className="max-w-[720px] mx-auto text-center mb-12">
        <div className="rounded-full bg-[#E6EDFB] px-3.5 py-1 w-fit mx-auto flex items-center gap-2 mb-3">
          <ChurchSvg />
          <span className="text-[10px] tracking-[2px] uppercase font-semibold text-[#0B4497]">
            {t('welcomePillarsEyebrow')}
          </span>
        </div>

        <h2 className="text-[32px] md:text-[36px] font-bold leading-tight text-[#0E203E]">
          {t('welcomePillarsTitle')}
        </h2>
        <p className="text-[15px] sm:text-[16px] text-[#5C6370] mt-3 leading-relaxed">
          {t('welcomePillarsBody')}
        </p>
      </div>

      {/* Asymmetric Top Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Left Card: 365 Guided Audio Liturgies */}
        <div className="lg:col-span-8 rounded-2xl overflow-hidden bg-white shadow-sm border border-[#E6EDFB] flex flex-col justify-between">
          <div className="relative h-64 sm:h-72 w-full overflow-hidden">
            <Image
              alt={t('welcomeChancelAlt')}
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 760px"
              src="/images/church.jpeg"
              unoptimized
            />
            {/* Top-left Pill */}
            <div className="absolute top-4 left-4 rounded-full bg-black/45 backdrop-blur-md px-3.5 py-1 text-white text-[11px] font-semibold tracking-wider border border-white/20 uppercase flex items-center gap-1.5">
              <SoundWaveIcon aria-hidden style={{ fontSize: 13 }} />
              <span>{t('welcomeAudioBadge')}</span>
            </div>

            {/* Bottom Text Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0)_100%)] p-6 pt-12">
              <h3 className="text-[24px] font-semibold text-white tracking-[-0.5px]">
                {t('welcomeAudioTitle')}
              </h3>
            </div>
          </div>

          <div className="p-6 pt-5 flex flex-col justify-between flex-1">
            <p className="text-[14px] sm:text-[15px] text-[#5C6370] leading-relaxed mb-6">
              {t('welcomeAudioBody')}
            </p>

            {/* Mini Schedule Blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LITURGY_SCHEDULE_BLOCKS.map((item) => (
                <div
                  className="bg-[#F6F6F6] rounded-xl p-4 flex items-center justify-between"
                  key={item.titleKey}
                >
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-[#0E203E]">
                      {t(item.titleKey)}
                    </span>
                    <span className="text-[12px] text-[#5C6370] mt-0.5">{t(item.timeKey)}</span>
                  </div>
                  <span aria-hidden className="w-2 h-2 rounded-full bg-[#2F7AD2] shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Card: Discover & Follow Your Church */}
        <div
          className="lg:col-span-4 rounded-2xl overflow-hidden bg-white shadow-sm border border-[#E6EDFB] flex flex-col justify-between"
          id="churches"
        >
          <div className="relative h-64 sm:h-72 w-full overflow-hidden">
            <Image
              alt={t('welcomeBalticParishAlt')}
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 360px"
              src="/images/wb3-devotional-lake.png"
              unoptimized
            />
            {/* Top-left Pill */}
            <div className="absolute top-4 left-4 rounded-full bg-black/45 backdrop-blur-md px-3.5 py-1 text-white text-[11px] font-semibold tracking-wider border border-white/20 uppercase flex items-center gap-1.5">
              <ChurchSvg />
              <span className="text-white">{t('welcomeParishDirectory')}</span>
            </div>

            {/* Bottom Text Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0)_100%)] p-6 pt-12">
              <h3 className="text-[24px] font-semibold text-white tracking-[-0.5px]">
                {t('welcomeChurchCardTitle')}
              </h3>
            </div>
          </div>

          <div className="p-6 pt-5 flex flex-col justify-between flex-1">
            <p className="text-[14px] text-[#5C6370] leading-relaxed mb-6">
              {t('welcomeChurchCardBody')}
            </p>

            {/* Parish Badge Card */}
            <div className="rounded-xl bg-[#F5F7FF] border border-[#E6EDFB] p-3 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <Image
                  alt={t('welcomeStMichaelChurch')}
                  className="object-cover"
                  fill
                  sizes="48px"
                  src="/images/church.jpeg"
                  unoptimized
                />
                <div className="absolute bottom-0 inset-x-0 bg-white/95 text-[8px] font-bold text-[#005CAD] flex items-center justify-center gap-0.5 py-0.5 shadow-xs">
                  <CheckOutlined style={{ fontSize: 7 }} />
                  <span>EELK</span>
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] tracking-wider uppercase font-semibold text-[#737C8C]">
                  {t('welcomeNearbyParishes')}
                </span>
                <span className="text-[14px] font-semibold text-[#0E203E] truncate">
                  {t('welcomeStMichaelChurch')}
                </span>
                <span className="text-[12px] text-[#5C6370] truncate">
                  {t('welcomeStMichaelAddress')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 3-Card Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="stewardship">
        {/* Card 1: Sacred Trust */}
        <div className="rounded-2xl bg-white p-6 sm:p-7 shadow-sm border border-[#E6EDFB] flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-[#E6EDFB] flex items-center justify-center text-[#2F7AD2] mb-4">
              <ShieldCheckIcon aria-hidden style={{ fontSize: 24 }} />
            </div>

            <span className="text-[10px] tracking-[2px] uppercase font-semibold text-[#2F7AD2]">
              {t('welcomeTrustEyebrow')}
            </span>
            <h3 className="text-[22px] font-semibold text-[#0E203E] mt-1 mb-2">
              {t('welcomeTrustTitle')}
            </h3>
            <p className="text-[14px] text-[#5C6370] leading-relaxed mb-6">
              {t('welcomeTrustBody')}
            </p>
          </div>

          <div className="rounded-xl bg-[#F5F7FF] p-3 flex items-center gap-3 border border-[#E6EDFB]">
            <div className="w-10 h-10 rounded-lg bg-[#E6EDFB] flex items-center justify-center text-[#2F7AD2] shrink-0">
              <LockIcon aria-hidden style={{ fontSize: 18 }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-[#0E203E]">
                {t('welcomeCanonPrivilege')}
              </span>
              <span className="text-[11px] text-[#5C6370]">{t('welcomeCanonPrivilegeHint')}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Generosity */}
        <div className="rounded-2xl bg-white p-6 sm:p-7 shadow-sm border border-[#E6EDFB] flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#D97706] mb-4">
              <HandHeartIcon aria-hidden style={{ fontSize: 24 }} />
            </div>

            <span className="text-[10px] tracking-[2px] uppercase font-semibold text-[#D97706]">
              {t('welcomeGenerosityEyebrow')}
            </span>
            <h3 className="text-[22px] font-semibold text-[#0E203E] mt-1 mb-2">
              {t('welcomeGenerosityTitle')}
            </h3>
            <p className="text-[14px] text-[#5C6370] leading-relaxed mb-6">
              {t('welcomeGenerosityBody')}
            </p>
          </div>

          <div className="rounded-xl bg-[#FEFCF6] p-3 flex items-center gap-3 border border-[#FBEEC6]">
            <div className="w-10 h-10 rounded-lg bg-[#FBEEC6] flex items-center justify-center text-[#D8A50E] shrink-0">
              <GivingIcon aria-hidden style={{ fontSize: 18 }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-[#0E203E]">
                {t('welcomeWinterCare')}
              </span>
              <span className="text-[11px] text-[#5C6370]">{t('welcomeWinterCareHint')}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Communion / Parish Events */}
        <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-[#E6EDFB] flex flex-col justify-between">
          <div className="relative h-40 w-full overflow-hidden">
            <Image
              alt={t('welcomeRetreatAlt')}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              src="/images/wb3-devotional-lake.png"
              unoptimized
            />
            <div className="absolute top-3 left-3 rounded-full bg-black/45 backdrop-blur-md px-3 py-0.5 text-white text-[10px] font-semibold tracking-wider border border-white/20 uppercase flex items-center gap-1.5">
              <ChurchSvg />
              <span className="text-white">{t('welcomeParishDirectory')}</span>
            </div>
          </div>

          <div className="p-6 pt-5 flex flex-col justify-between flex-1">
            <div>
              <h3 className="text-[22px] font-semibold text-[#0E203E] mb-2">
                {t('welcomeEventsTitle')}
              </h3>
              <p className="text-[14px] text-[#5C6370] leading-relaxed mb-6">
                {t('welcomeEventsBody')}
              </p>
            </div>

            <div className="rounded-xl bg-[#EDFDF9] p-3 flex items-center justify-between border border-[#D3FAEF]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D3FAEF] flex items-center justify-center text-[#0AC28E] shrink-0">
                  <CalendarClockIcon aria-hidden style={{ fontSize: 18 }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-[#0E203E]">
                    {t('welcomeNextVigil')}
                  </span>
                  <span className="text-[11px] text-[#5C6370]">{t('welcomeNextVigilHint')}</span>
                </div>
              </div>
              <AngleRightIcon aria-hidden className="text-[#0AC28E]" style={{ fontSize: 14 }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
