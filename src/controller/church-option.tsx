import { ChurchOption, ChurchOptionQuery } from '@/models/church-option'
import { LIST_CHURCH_OPTIONS, LIST_FREQUENT_CHURCHES } from '@/providers/church-option'

/*
 * Public church picker (WB1 sign-up step 2). No session: callers are not
 * signed in yet, so these return only the public option row.
 */

export const listChurchOptions = async ({
  query,
}: {
  query: ChurchOptionQuery
}): Promise<ChurchOption[]> => LIST_CHURCH_OPTIONS({ query })

export const listFrequentChurches = async (): Promise<ChurchOption[]> => LIST_FREQUENT_CHURCHES()
