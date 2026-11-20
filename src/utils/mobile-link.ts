import type { NextRequest } from 'next/server'

/**
 * Emailed links for the mobile app are deep links (`prayer-365://…`), not web URLs.
 * The app marks its own requests with `X-Client: mobile`; the website never sends it.
 * Returns the deep-link prefix for a mobile request, otherwise undefined (web link stays).
 */
export const mobileLinkPrefix = (req: NextRequest): string | undefined =>
  req.headers.get('x-client') === 'mobile'
    ? `${process.env.NEXT_PUBLIC_MOBILE_SCHEME ?? 'prayer-365'}://`
    : undefined
