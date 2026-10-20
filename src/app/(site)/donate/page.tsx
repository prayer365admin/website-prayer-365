import { listMyChurches, listPublicChurches } from '@/controller/mobile'
import { MobileChurchListQuerySchema } from '@/models/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { validate } from '@/utils/validate'
import { redirect } from 'next/navigation'

/**
 * Bare `/donate` entry. Resolves the user's primary parish, or falls back to
 * the flagship parish (St. John's Church) or first approved parish so the
 * reader always lands on a live offering portal rather than 404ing.
 */
export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const churches = await listMyChurches({ userId: web.session.user.user_id })
  const main = churches.find((row) => row.isMain) ?? churches[0] ?? null
  if (main) {
    redirect(`/donate/${main.churchId}`)
  }

  const preferred = await listPublicChurches({
    query: validate(MobileChurchListQuerySchema, { search: 'St. John', limit: 1 }),
  })
  const fallback =
    preferred.result[0] ??
    (
      await listPublicChurches({
        query: validate(MobileChurchListQuerySchema, { limit: 1 }),
      })
    ).result[0]

  redirect(fallback ? `/donate/${fallback.id}` : '/churches')
}
