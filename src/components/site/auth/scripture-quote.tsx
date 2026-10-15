import { QuoteIcon } from '@/components/icon/quote'

/** Serif scripture quote with a spaced-caps reference (WB1 design). */
export default function ScriptureQuote({
  quote,
  reference,
  className = '',
}: {
  quote: string
  reference: string
  className?: string
}) {
  return (
    <figure className={`rounded-xl bg-gray-100 p-5 ${className} mt-0`}>
      <div className="flex gap-3">
        <QuoteIcon
          aria-hidden
          className="mt-1 shrink-0 self-start !text-primary-500"
          style={{ fontSize: 20 }}
        />
        <blockquote className="font-font_quote text-2xl italic leading-tight text-blue-800 md:text-[32px]">
          {quote}
        </blockquote>
      </div>
      <figcaption className="mt-1 pl-8 text-[10px] uppercase tracking-[0.2em] text-neutral-600">
        {reference}
      </figcaption>
    </figure>
  )
}
