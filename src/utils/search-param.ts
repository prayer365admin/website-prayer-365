/*
 * Next.js gives a repeated search param as string[]. Every page that reads
 * `searchParams` needs the same first-value + trim rule, so it lives here
 * instead of being re-typed (and drifting) per page.
 */
export const firstParam = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined
