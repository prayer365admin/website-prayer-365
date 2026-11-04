import { AngleRightIcon } from '@/components/icon/angle-right'
import { CheckOutlined } from '@/components/icon/antd-icons'
import { CalendarClockIcon } from '@/components/icon/calendar-clock'
import { GivingIcon } from '@/components/icon/giving'
import { HandHeartIcon } from '@/components/icon/hand-heart'
import { LockIcon } from '@/components/icon/lock'
import { ShieldCheckIcon } from '@/components/icon/shield-check'
import { SoundWaveIcon } from '@/components/icon/sound-wave'
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
  return (
    <section
      aria-label="Five Pillars of Our Digital Sanctuary"
      className="py-16 md:py-24 px-6 max-w-[1280px] mx-auto"
      id="pillars"
    >
      {/* Centered Section Header */}
      <div className="max-w-[720px] mx-auto text-center mb-12">
        <div className="rounded-full bg-[#E6EDFB] px-3.5 py-1 w-fit mx-auto flex items-center gap-2 mb-3">
          <ChurchSvg />
          <span className="text-[10px] tracking-[2px] uppercase font-semibold text-[#0B4497]">
            Sacred Architecture &amp; Living Church
          </span>
        </div>

        <h2 className="text-[32px] md:text-[36px] font-bold leading-tight text-[#0E203E]">
          Five Pillars of Our Digital Sanctuary
        </h2>
        <p className="text-[15px] sm:text-[16px] text-[#5C6370] mt-3 leading-relaxed">
          Engineered for serene contemplation and active parish communion. Discover how Prayer 365
          nurtures your walk with Christ from dawn matins to evening rest.
        </p>
      </div>

      {/* Asymmetric Top Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Left Card: 365 Guided Audio Liturgies */}
        <div className="lg:col-span-8 rounded-2xl overflow-hidden bg-white shadow-sm border border-[#E6EDFB] flex flex-col justify-between">
          <div className="relative h-64 sm:h-72 w-full overflow-hidden">
            <Image
              alt="Historic sanctuary chancel"
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 760px"
              src="/images/church.jpeg"
              unoptimized
            />
            {/* Top-left Pill */}
            <div className="absolute top-4 left-4 rounded-full bg-black/45 backdrop-blur-md px-3.5 py-1 text-white text-[11px] font-semibold tracking-wider border border-white/20 uppercase flex items-center gap-1.5">
              <SoundWaveIcon aria-hidden style={{ fontSize: 13 }} />
              <span>Matins, Angelus &amp; Compline</span>
            </div>

            {/* Bottom Text Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0)_100%)] p-6 pt-12">
              <h3 className="text-[24px] font-semibold text-white tracking-[-0.5px]">
                365 Guided Audio Liturgies
              </h3>
            </div>
          </div>

          <div className="p-6 pt-5 flex flex-col justify-between flex-1">
            <p className="text-[14px] sm:text-[15px] text-[#5C6370] leading-relaxed mb-6">
              Morning matins, midday pause, and evening compline narrated by accredited Baltic
              pastors with soothing pipe organ, kantele, and cello accompaniment. Complete with
              synchronized prayer transcripts and offline listening support.
            </p>

            {/* Mini Schedule Blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LITURGY_SCHEDULE_BLOCKS.map((item) => (
                <div
                  className="bg-[#F6F6F6] rounded-xl p-4 flex items-center justify-between"
                  key={item.title}
                >
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-[#0E203E]">{item.title}</span>
                    <span className="text-[12px] text-[#5C6370] mt-0.5">{item.time}</span>
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
              alt="Baltic parish sanctuary"
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 360px"
              src="/images/wb3-devotional-lake.png"
              unoptimized
            />
            {/* Top-left Pill */}
            <div className="absolute top-4 left-4 rounded-full bg-black/45 backdrop-blur-md px-3.5 py-1 text-white text-[11px] font-semibold tracking-wider border border-white/20 uppercase flex items-center gap-1.5">
              <ChurchSvg />
              <span className="text-white">Parish Directory</span>
            </div>

            {/* Bottom Text Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0)_100%)] p-6 pt-12">
              <h3 className="text-[24px] font-semibold text-white tracking-[-0.5px]">
                Discover &amp; Follow Your Church
              </h3>
            </div>
          </div>

          <div className="p-6 pt-5 flex flex-col justify-between flex-1">
            <p className="text-[14px] text-[#5C6370] leading-relaxed mb-6">
              Explore verified parishes across Estonia, Finland, and the Baltic Sea. Select your
              home parish for bulletins, worship schedules, and seasonal festivals.
            </p>

            {/* Parish Badge Card */}
            <div className="rounded-xl bg-[#F5F7FF] border border-[#E6EDFB] p-3 flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <Image
                  alt="St. Michael's Church"
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
                  NEARBY PARISHES
                </span>
                <span className="text-[14px] font-semibold text-[#0E203E] truncate">
                  St. Michael&apos;s Church
                </span>
                <span className="text-[12px] text-[#5C6370] truncate">
                  Rootsi-Mihkli kirik • Rüütli 9
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
              Sacred Trust
            </span>
            <h3 className="text-[22px] font-semibold text-[#0E203E] mt-1 mb-2">
              Confidential Pastoral Care
            </h3>
            <p className="text-[14px] text-[#5C6370] leading-relaxed mb-6">
              Submit prayer requests or request pastoral visits directly to ordained clergy under
              canonical seal of confidentiality and end-to-end 256-bit encryption.
            </p>
          </div>

          <div className="rounded-xl bg-[#F5F7FF] p-3 flex items-center gap-3 border border-[#E6EDFB]">
            <div className="w-10 h-10 rounded-lg bg-[#E6EDFB] flex items-center justify-center text-[#2F7AD2] shrink-0">
              <LockIcon aria-hidden style={{ fontSize: 18 }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-[#0E203E]">Canon Law Privilege</span>
              <span className="text-[11px] text-[#5C6370]">
                Strict pastoral confidentiality preserved
              </span>
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
              Generosity
            </span>
            <h3 className="text-[22px] font-semibold text-[#0E203E] mt-1 mb-2">
              Diaconal Giving &amp; Stewardship
            </h3>
            <p className="text-[14px] text-[#5C6370] leading-relaxed mb-6">
              Support parish upkeep, winter warmth soup kitchens, and humanitarian diaconia with
              transparent, fee-free giving and instant automated tax receipts.
            </p>
          </div>

          <div className="rounded-xl bg-[#FEFCF6] p-3 flex items-center gap-3 border border-[#FBEEC6]">
            <div className="w-10 h-10 rounded-lg bg-[#FBEEC6] flex items-center justify-center text-[#D8A50E] shrink-0">
              <GivingIcon aria-hidden style={{ fontSize: 18 }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-[#0E203E]">Winter Parish Care</span>
              <span className="text-[11px] text-[#5C6370]">Tallinn Diaconal Pantry</span>
            </div>
          </div>
        </div>

        {/* Card 3: Communion / Parish Events */}
        <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-[#E6EDFB] flex flex-col justify-between">
          <div className="relative h-40 w-full overflow-hidden">
            <Image
              alt="Baltic parish monastery retreat"
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              src="/images/wb3-devotional-lake.png"
              unoptimized
            />
            <div className="absolute top-3 left-3 rounded-full bg-black/45 backdrop-blur-md px-3 py-0.5 text-white text-[10px] font-semibold tracking-wider border border-white/20 uppercase flex items-center gap-1.5">
              <ChurchSvg />
              <span className="text-white">Parish Directory</span>
            </div>
          </div>

          <div className="p-6 pt-5 flex flex-col justify-between flex-1">
            <div>
              <h3 className="text-[22px] font-semibold text-[#0E203E] mb-2">
                Parish Events &amp; Retreats
              </h3>
              <p className="text-[14px] text-[#5C6370] leading-relaxed mb-6">
                RSVP for Taizé candlelight vigils, Bach cantata vespers, diocesan youth retreats,
                and silent weekend pilgrimages in ancient Baltic monasteries.
              </p>
            </div>

            <div className="rounded-xl bg-[#EDFDF9] p-3 flex items-center justify-between border border-[#D3FAEF]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D3FAEF] flex items-center justify-center text-[#0AC28E] shrink-0">
                  <CalendarClockIcon aria-hidden style={{ fontSize: 18 }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-[#0E203E]">Next Taizé Vigil</span>
                  <span className="text-[11px] text-[#5C6370]">
                    Friday 19:30 • 48 Pews Reserved
                  </span>
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
