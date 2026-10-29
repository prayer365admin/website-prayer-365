import { db } from '@/utils/db-connection'
import { CUSTOMER_ACCOUNT_FILTER } from '@/utils/customer-role'
import { ChurchOption, ChurchOptionQuery } from '@/models/church-option'

/*
 * Public church picker reads (WB1 sign-up step 2). APPROVED churches only;
 * suspended / archived are never returned. Minimal select: id, name, address
 * (for the city), nothing else.
 */

const APPROVED = 'APPROVED'
const OPTION_LIMIT = 20
const FREQUENT_LIMIT = 4

const select = { id: true, slug: true, name: true, address: true } as const

const toOption = (c: {
  id: string
  slug: string
  name: string
  address: unknown
}): ChurchOption => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  city: (c.address as { city?: string } | null)?.city ?? null,
})

export const LIST_CHURCH_OPTIONS = async ({
  query,
}: {
  query: ChurchOptionQuery
}): Promise<ChurchOption[]> => {
  const rows = await db.church.findMany({
    where: {
      status: APPROVED,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: OPTION_LIMIT,
    select,
  })
  return rows.map(toOption)
}

/**
 * Top approved churches by follower count. A follower is a user_churches row
 * with is_followed OR is_main (choosing a main church follows it). One grouped
 * count on the indexed church_id; topped up alphabetically when fewer churches
 * have followers (fresh install).
 */
export const LIST_FREQUENT_CHURCHES = async (): Promise<ChurchOption[]> => {
  const counts = await db.userChurch.groupBy({
    by: ['church_id'],
    where: {
      OR: [{ is_followed: true }, { is_main: true }],
      church: { status: APPROVED },
      user: CUSTOMER_ACCOUNT_FILTER,
    },
    _count: { church_id: true },
    orderBy: [{ _count: { church_id: 'desc' } }, { church_id: 'asc' }],
    take: FREQUENT_LIMIT,
  })
  const ids = counts.map((c) => c.church_id)

  const followed = await db.church.findMany({
    where: { id: { in: ids }, status: APPROVED },
    select,
  })
  const byId = new Map(followed.map((c) => [c.id, c]))
  const ranked = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))

  const missing = FREQUENT_LIMIT - ranked.length
  const filler =
    missing > 0
      ? await db.church.findMany({
          where: { status: APPROVED, id: { notIn: ids } },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: missing,
          select,
        })
      : []

  return [...ranked, ...filler].map(toOption)
}
