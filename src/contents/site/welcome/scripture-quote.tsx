import { QuoteIcon } from '@/components/icon/quote'
import { SCRIPTURE_BLESSING } from './data'

export default function WelcomeScriptureQuote() {
  return (
    <section
      aria-label="Scripture Blessing"
      className="border-b border-[#DDE0E4] bg-white px-6 py-10"
    >
      <div className="mx-auto max-w-[1152px]">
        <div className="rounded-2xl bg-[linear-gradient(170.88deg,rgba(194,217,255,0.4)_0%,rgba(255,255,255,0)_100%),linear-gradient(90deg,#ffffff_0%,#ffffff_100%)] p-4 shadow-[-1px_-1px_2px_0_#ffffff,0px_1px_2px_0_rgba(0,0,0,0.05)]">
          <div className="flex flex-col items-center gap-2 rounded-xl bg-[#F5F7FF] p-4 text-center">
            <QuoteIcon aria-hidden className="text-[#2F7AD2]" style={{ fontSize: 20 }} />

            <blockquote className="max-w-[820px] font-font_quote text-[24px] italic leading-[1.15] text-[#0B4497] md:text-[32px]">
              {SCRIPTURE_BLESSING.quote}
            </blockquote>

            <cite className="text-[10px] font-semibold uppercase not-italic tracking-[2px] text-[#5C6370]">
              {SCRIPTURE_BLESSING.attribution}
            </cite>
          </div>
        </div>
      </div>
    </section>
  )
}
