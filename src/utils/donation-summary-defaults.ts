/**
 * Current UTC calendar month: [first day 00:00, last millisecond of the month].
 * Shared by the two central summary routes so their default window cannot drift.
 */
export const currentUtcMonth = (now = new Date()): { from: Date; to: Date } => {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  return { from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 1) - 1) }
}
