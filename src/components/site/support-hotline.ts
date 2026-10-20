/**
 * Pastoral care hotline shown in the website footer.
 *
 * `number` must be a real, verified PRAYER number before public launch. While it
 * is empty the footer offers the church directory link instead — no placeholder
 * phone number is ever rendered.
 */
export const SUPPORT_HOTLINE = { number: '' }

/** `tel:` href built from the displayed number, so the text and the link cannot drift. */
export const dialHref = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`
