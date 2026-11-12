/*
 * Pure planning for the one-off donation dedupe: given the ledger rows and the
 * canonical Stripe payment id each row resolves to, decide which row survives
 * and which duplicates are deleted. No DB, no network — testable on its own.
 */

export interface DonateDedupeRow {
  id: string
  providerPaymentId: string
  churchId: string
  amountMinor: bigint
  refundedMinor: bigint
  currency: string
  status: string
  paidAt: Date | null
  createdAt: Date
}

export interface DedupeGroup {
  canonicalId: string
  keeperId: string
  deleteIds: string[]
  /**
   * Values the keeper must carry after the merge: the most refunded and the
   * earliest paid timestamp of any row in the group, so deleting the twin never
   * loses refund state or shifts the month the gift is reported in.
   */
  keeper: {
    refundedMinor: bigint
    paidAt: Date | null
  }
}

export interface DedupePlan {
  groups: DedupeGroup[]
  /** Rows the provider could not resolve; never deleted. */
  unresolved: Array<{ row: DonateDedupeRow; reason: string }>
}

/**
 * One group per canonical payment id. A row already keyed by that id wins,
 * otherwise the earliest-created row survives and the rest are duplicates.
 */
export const planDonationDedupe = (
  rows: DonateDedupeRow[],
  resolve: (row: DonateDedupeRow) => { canonicalId?: string | null; error?: string },
): DedupePlan => {
  const byCanonical = new Map<string, DonateDedupeRow[]>()
  const unresolved: DedupePlan['unresolved'] = []

  for (const row of rows) {
    const resolved = resolve(row)
    if (!resolved.canonicalId) {
      unresolved.push({ row, reason: resolved.error ?? 'no canonical payment id' })
      continue
    }
    const bucket = byCanonical.get(resolved.canonicalId)
    if (bucket) bucket.push(row)
    else byCanonical.set(resolved.canonicalId, [row])
  }

  const groups: DedupeGroup[] = []
  for (const [canonicalId, bucket] of Array.from(byCanonical.entries())) {
    const keeper =
      bucket.find((row) => row.providerPaymentId === canonicalId) ??
      [...bucket].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
    const refundedIds = bucket.map((row) => row.refundedMinor)
    const refundedMinor = refundedIds.reduce((a, b) => (a > b ? a : b), BigInt(0))
    const paidAts = bucket
      .map((row) => row.paidAt)
      .filter((paidAt): paidAt is Date => paidAt !== null)
      .sort((a, b) => a.getTime() - b.getTime())

    groups.push({
      canonicalId,
      keeperId: keeper.id,
      deleteIds: bucket.filter((row) => row.id !== keeper.id).map((row) => row.id),
      keeper: {
        refundedMinor,
        paidAt: paidAts[0] ?? null,
      },
    })
  }

  return { groups, unresolved }
}
