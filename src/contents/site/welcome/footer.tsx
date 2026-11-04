import Image from 'next/image'
import Link from 'next/link'
import { FOOTER_DATA } from './data'

export default function WelcomeFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white px-6 py-6 shadow-[0px_-1px_3px_rgba(47,122,210,0.03)]">
      <div className="mx-auto max-w-[1152px]">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand, verse, attribution */}
          <div className="flex flex-col gap-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <Image
                alt="Prayer 365 Logo"
                className="rounded-lg object-contain"
                height={32}
                src="/images/logo.png"
                unoptimized
                width={32}
              />
              <span className="text-[20px] font-bold leading-7 tracking-[-0.5px] text-[#005CAD]">
                Prayer 365
              </span>
              <span className="text-[12px] font-medium text-[#414752]">
                {FOOTER_DATA.brandSubtitle}
              </span>
            </div>

            <blockquote className="max-w-[512px] font-font_quote text-[24px] italic leading-[1.15] text-[#191C1E] md:text-[32px]">
              {FOOTER_DATA.verse}
            </blockquote>

            <p className="text-[12px] text-[#737C8C]">{FOOTER_DATA.verseReference}</p>
          </div>

          {/* Parish network */}
          <div className="flex flex-col gap-3 md:pb-[90px]">
            <h3 className="text-[10px] font-semibold uppercase tracking-[2px] text-[#191C1E]">
              Parish Network
            </h3>
            <nav aria-label="Parish Network Links" className="flex flex-col gap-2">
              {FOOTER_DATA.parishLinks.map((link) => (
                <Link
                  className="text-[14px] font-semibold text-[#5C6370] transition-colors hover:text-[#2F7AD2]"
                  href={link.href}
                  key={link.label}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Pastoral care */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[2px] text-[#191C1E]">
              Pastoral Care &amp; Support
            </h3>
            <div className="flex flex-col gap-1 rounded-xl bg-[#F6F6F6] px-3 pb-3.5 pt-3">
              <span className="text-[12px] text-[#5C6370]">{FOOTER_DATA.hotlineLabel}</span>
              <a
                className="text-[20px] font-semibold text-[#2F7AD2] hover:underline"
                href={`tel:${FOOTER_DATA.hotline.replace(/\s+/g, '')}`}
              >
                {FOOTER_DATA.hotline}
              </a>
              <span className="text-[12px] text-[#5C6370]">{FOOTER_DATA.hotlineNote}</span>
            </div>
          </div>
        </div>

        {/* Legal row */}
        <div className="flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row">
          <p className="text-[12px] text-[#737C8C]">
            &copy; {currentYear} Prayer 365 Sanctuary. Ecumenical Christian Devotional Network. All
            rights reserved in faith.
          </p>

          <nav aria-label="Legal and Policy Links" className="flex flex-wrap items-center gap-6">
            {FOOTER_DATA.legalLinks.map((link) => (
              <Link
                className="text-[12px] font-semibold text-[#393E46] transition-colors hover:text-[#2F7AD2]"
                href={link.href}
                key={link.label}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
