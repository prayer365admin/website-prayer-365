import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { LockIcon } from '@/components/icon/lock'
import { useSiteI18n } from '@/i18n/site-i18n'
import Link from 'next/link'

export default function WelcomeCtaParishioner() {
  const { t } = useSiteI18n()

  return (
    <section aria-label={t('welcomePortalBadge')} className="py-10 px-6 max-w-[1280px] mx-auto">
      <div className="rounded-2xl bg-white p-8 md:p-10 shadow-sm border border-[#E6EDFB] flex flex-col md:flex-row items-start justify-between gap-6">
        {/* Left Copy */}
        <div className="max-w-[705px]">
          <div className="rounded-full bg-[#E6EDFB] px-3.5 py-1 w-fit flex items-center gap-2 text-[#0B4497] text-[10px] tracking-[2px] uppercase font-semibold mb-3">
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
            <span>{t('welcomePortalBadge')}</span>
          </div>

          <h3 className="text-[28px] md:text-[32px] font-bold text-[#0E203E] leading-tight">
            {t('welcomeCtaTitle')}
          </h3>

          <p className="text-[14px] sm:text-[15px] text-[#5C6370] mt-3 leading-relaxed max-w-[576px]">
            {t('welcomeCtaBody')}
          </p>
        </div>

        {/* Right Buttons */}
        <div className="mt-auto flex flex-wrap items-center gap-3 shrink-0">
          <Link
            className="h-10 rounded-lg bg-[#2F7AD2] text-white text-[14px] font-semibold px-4 flex items-center gap-1.5 hover:bg-[#256bb8] transition-colors shadow-sm"
            href="/register"
          >
            <span>{t('welcomeCreateProfile')}</span>
            <ArrowRightIcon aria-hidden style={{ fontSize: 14 }} />
          </Link>

          <Link
            className="h-10 rounded-lg border border-[#2F7AD2] bg-white text-[#2F7AD2] text-[14px] font-semibold px-4 flex items-center gap-2 hover:bg-[#F5F7FF] transition-colors"
            href="/login"
          >
            <LockIcon aria-hidden className="text-[#2F7AD2]" style={{ fontSize: 14 }} />
            <span>{t('welcomeSignInSanctuary')}</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
