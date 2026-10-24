/** Prayer body paragraphs: blank lines separate paragraphs, single newlines stay as line breaks. */
export const paragraphs = (body: string) =>
  body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
