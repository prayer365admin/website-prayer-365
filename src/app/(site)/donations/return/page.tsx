import ContentsSiteDonationReturn from '@/contents/site/donation-return'
import { firstParam } from '@/utils/search-param'

/**
 * F11 return landing page (WB4b). The provider redirects the giver here with
 * `?outcome=success|cancel`. With the app installed this URL never reaches the
 * browser (it is a verified universal link); this page is the fallback for a
 * device without the app or a link that failed verification.
 *
 * Deliberately public: `requiredWebAuth` would bounce a giver straight from a
 * checkout into `/login`, and the page reads no user data at all — the outcome on
 * the app side comes from the ledger, never from this URL.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const outcome = firstParam(params.outcome) ?? null

  return <ContentsSiteDonationReturn outcome={outcome} />
}
