import sanitizeHtml from 'sanitize-html'

const allowedTags = [
  'p',
  'div',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'span',
  'ol',
  'ul',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
]

/** Allows editor formatting while removing scripts, attributes, links, media, and embedded content. */
export const sanitizePrayerRichText = (value: string) =>
  sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: { span: ['style'], li: ['data-list'] },
    allowedStyles: {
      span: {
        color: [/^(?:#2f7ad2|rgb\(47,\s*122,\s*210\))$/i],
      },
    },
    transformTags: {
      font: (_tagName, attributes) => {
        const attribs: Record<string, string> = {}
        if (attributes.color?.toLowerCase() === '#2f7ad2') attribs.style = 'color:#2f7ad2'
        return { tagName: 'span', attribs }
      },
    },
    exclusiveFilter: (frame) => frame.tag === 'span' && !frame.attribs.style && !frame.text.trim(),
    disallowedTagsMode: 'discard',
  }).trim()
