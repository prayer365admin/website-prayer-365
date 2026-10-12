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
    <figure className={`rounded-xl bg-[#f3f6fa] p-5 ${className}`}>
      <div className="flex gap-3">
        <span
          aria-hidden
          className="font-font_heading text-xl font-bold leading-none text-primary_color"
        >
          &ldquo;
        </span>
        <blockquote className="font-font_quote text-2xl italic leading-tight text-accent_color_2 md:text-3xl">
          {quote}
        </blockquote>
      </div>
      <figcaption className="mt-3 pl-6 text-xs uppercase tracking-[0.2em] text-accent_color_1">
        {reference}
      </figcaption>
    </figure>
  )
}
