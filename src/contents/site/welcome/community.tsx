import { useSiteI18n } from '@/i18n/site-i18n'
import Image from 'next/image'
import { MOSAIC_TILES } from './data'

export default function WelcomeCommunity() {
  const { t } = useSiteI18n()

  return (
    <section
      aria-label={t('welcomeCommunityTitle')}
      className="py-16 md:py-24 px-6 max-w-[1280px] mx-auto"
    >
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="max-w-[560px]">
          <div className="rounded-full bg-[#E6EDFB] px-3.5 py-1 w-fit flex items-center gap-2 text-[#0B4497] text-[10px] tracking-[2px] uppercase font-semibold mb-3">
            <svg aria-hidden="true" fill="none" height="11" viewBox="0 0 12 11" width="12">
              <path
                d="M0 0H12V10.5H0V0ZM7.57031 4.00781L7.125 3.35156L6.65625 3.98438L4.59375 6.89062L3.96094 6.1875L3.5625 5.71875L3.14062 6.21094L1.64062 7.89844L1.5 8.03906V8.25V8.4375V9H2.0625H3.75H4.3125H5.0625H5.625H9.9375H10.5V8.4375V8.25V8.08594L10.3828 7.92188L7.57031 3.98438V4.00781ZM2.625 3.75C3.02344 3.75 3.375 3.53906 3.58594 3.1875C3.79688 2.85938 3.79688 2.41406 3.58594 2.0625C3.375 1.73438 3.02344 1.5 2.625 1.5C2.20312 1.5 1.85156 1.73438 1.64062 2.0625C1.42969 2.41406 1.42969 2.85938 1.64062 3.1875C1.85156 3.53906 2.20312 3.75 2.625 3.75Z"
                fill="#0B4497"
              />
            </svg>
            <span>{t('welcomeCommunityEyebrow')}</span>
          </div>
          <h2 className="text-[32px] md:text-[36px] font-bold text-[#0E203E] leading-tight">
            {t('welcomeCommunityTitle')}
          </h2>
        </div>
        <p className="text-[15px] text-[#5C6370] max-w-[461px] leading-relaxed">
          {t('welcomeCommunityBody')}
        </p>
      </div>

      {/* 3 Mosaic Photo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOSAIC_TILES.map((tile) => (
          <div
            className="relative h-[384px] rounded-2xl overflow-hidden shadow-sm group border border-[#E6EDFB]"
            key={tile.titleKey}
          >
            <Image
              alt={t('welcomeCommunityTitle')}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              fill
              sizes="(max-width: 768px) 100vw, 384px"
              src={tile.imageSrc}
              unoptimized
            />
            {/* Scrim Overlay */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(0deg,rgba(14,32,62,0.92)_0%,rgba(14,32,62,0.4)_50%,rgba(14,32,62,0)_100%)]"
            />

            {/* Bottom Content */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col justify-end text-white">
              <div className="flex items-center gap-1.5 text-[#F0B80F] mb-1">
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
                    fill="currentColor"
                  />
                </svg>
                <span className="text-[10px] tracking-[2px] uppercase font-semibold">
                  {t(tile.eyebrowKey)}
                </span>
              </div>
              <h3 className="text-white text-[22px] leading-[28px] font-semibold mb-2">
                {t(tile.titleKey)}
              </h3>
              <p className="text-[13px] text-[#DDE0E4] leading-relaxed">{t(tile.descriptionKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
