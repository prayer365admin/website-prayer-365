import { z } from 'zod'
import { DonationInputSchema, DonationStatusQuerySchema } from './donation'

/*
 * Mobile donation payloads (MB-02 / F11).
 *
 * Differences from the website schemas are deliberate and small:
 *  - the church is the PATH (the app never posts a beneficiary it could tamper with),
 *  - the giver is the bearer token (never a body field),
 *  - the provider's return URL is a redirect target we choose, so it is allowlisted. The
 *    provider sends the giver wherever we point it; an arbitrary origin would be an open
 *    redirect at the exact moment a card has just been entered.
 *
 * Accepted return shapes (universal links, decision 2026-10-24):
 *    <APP_LINK_ORIGINS>/donations/…  → Universal Link / App Link. The origins are CONFIG, not
 *                                      code: staging `https://prayer-365.catatia.com`,
 *                                      production `https://prayer365.eu`. The app claims this
 *                                      host + path; the rest of the website stays in the browser
 *    exp://…                         → Expo Go during development (universal links cannot work)
 *    prayer-365://donations/…        → builds made before the universal-link switch
 *
 * `APP_LINK_ORIGINS` is a comma-separated list, so one deployment can accept several domains
 * (e.g. a domain rename overlapping) without a code change. Unset → only the scheme/Expo Go
 * shapes are accepted, which fails closed for a redirect target.
 */

/** Split `APP_LINK_ORIGINS` into usable origins: comma-separated, trimmed, no trailing slash. */
export const parseAppLinkOrigins = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean)

/** Origins this deployment accepts as app return targets. */
export const APP_LINK_ORIGINS = parseAppLinkOrigins(process.env.APP_LINK_ORIGINS)

// Expo Go cannot resolve universal links, so exp:// is a development shape only:
// in production it would be an arbitrary redirect target at the card-entered moment.
const isProduction = process.env.APP_ENV?.toUpperCase() === 'PROD'

const APP_RETURN_PREFIXES: string[] = [
  ...APP_LINK_ORIGINS.map((origin) => `${origin}/donations/`),
  ...(isProduction ? [] : ['exp://']),
  'prayer-365://donations/',
]

const appReturnUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => APP_RETURN_PREFIXES.some((prefix) => value.startsWith(prefix)), {
    message:
      'Must be an app return URL on a configured app domain (/donations/…), exp://, or prayer-365://donations/…',
  })

/** BA-1 body: `DonationInputSchema` with the return URLs constrained to app return targets. */
export const MobileDonationInitiateSchema = DonationInputSchema.extend({
  successUrl: appReturnUrl.optional(),
  cancelUrl: appReturnUrl.optional(),
}).strict()

export type MobileDonationInitiate = z.infer<typeof MobileDonationInitiateSchema>

/** BA-2 query: the built status query, unchanged (sessionId is part of the attempt tuple). */
export const MobileDonationStatusQuerySchema = DonationStatusQuerySchema

export type MobileDonationStatusQuery = z.infer<typeof MobileDonationStatusQuerySchema>

/** BA-3 body: the giver's own pledge is resolved server-side; only the return URL is client data. */
export const MobileBillingPortalRequestSchema = z.object({ returnUrl: appReturnUrl }).strict()

export type MobileBillingPortalRequest = z.infer<typeof MobileBillingPortalRequestSchema>

/*
 * BA-4 read: the caller's own active monthly pledge.
 *
 * `GET_MY_ACTIVE_GIFT` selects no frequency — every row it returns is an active
 * subscription, so the wire contract states `frequency: 'monthly'` explicitly
 * instead of leaving the client to infer it. `currency` is lower-cased like every
 * other mobile donation payload. A caller with no live pledge is `result: null`,
 * not a 404: "no pledge" is the normal answer for most givers.
 */
export const MobileActiveDonationSchema = z.object({
  churchId: z.string(),
  churchName: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  frequency: z.literal('monthly'),
})

export type MobileActiveDonation = z.infer<typeof MobileActiveDonationSchema>
