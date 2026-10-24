/** Fixes pasted non-breaking spaces while retaining blank paragraphs from the editor. */
export const normalizeRichTextWhitespace = (value: string) =>
  value
    .replace(/(?:[ \t]*(?:\u00a0|\u202f|&nbsp;|&#160;|&#x0*a0;)[ \t]*)+/gi, ' ')
    .replace(/<(p|div)([^>]*)>\s*<\/\1>/gi, '<$1$2><br></$1>')

export default function RichTextContent({
  html,
  className = '',
}: {
  html: string
  className?: string
}) {
  const normalizedHtml = normalizeRichTextWhitespace(html)
  const classNames = `break-words whitespace-normal text-inherit [&>*+*]:mt-4 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-primary-300 [&_blockquote]:bg-primary-100/60 [&_blockquote]:py-3 [&_blockquote]:pl-4 [&_blockquote]:pr-4 [&_blockquote]:italic [&_h1]:m-0 [&_h1]:text-[inherit] [&_h1]:font-[inherit] [&_h1]:leading-[inherit] [&_h2]:m-0 [&_h2]:text-[inherit] [&_h2]:font-[inherit] [&_h2]:leading-[inherit] [&_h3]:m-0 [&_h3]:text-[inherit] [&_h3]:font-[inherit] [&_h3]:leading-[inherit] [&_li]:pl-1 [&_li]:leading-relaxed [&_li[data-list=bullet]]:list-disc [&_li[data-list=ordered]]:list-decimal [&_ol]:my-4 [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:m-0 [&_p]:whitespace-pre-wrap [&_strong]:font-semibold [&_u]:decoration-primary-400 [&_u]:decoration-2 [&_u]:underline-offset-2 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 ${className}`

  // Existing prayers are plain text. Keep their historical paragraph behavior
  // while newly formatted content is rendered from server-sanitized HTML.
  if (!/<[a-z][\s\S]*>/i.test(normalizedHtml)) {
    return (
      <div className={classNames}>
        {normalizedHtml
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
      </div>
    )
  }

  return <div className={classNames} dangerouslySetInnerHTML={{ __html: normalizedHtml }} />
}
