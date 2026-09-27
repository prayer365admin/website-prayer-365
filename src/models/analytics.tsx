import { z } from 'zod'

/*
 * Analytics DTOs (SPEC §8.2 / F9-F10, Tasks 31-32). All metrics are derived
 * from SOURCE records (payments, check-ins, events) — never from client
 * analytics-events that could report reads/listens as attendance. Attendance
 * is aggregated by local calendar date only (no named records), and the
 * regional summary is aggregate-only (never private requests, never raw donor
 * rows). Money is per-currency, never cross-currency summed.
 */

export const AnalyticsMetricsSchema = z.object({
  from: z.date().nullable(),
  to: z.date().nullable(),
  checkInCount: z.number(),
  eventCount: z.number(),
  prayerCount: z.number(),
  donationCount: z.number(),
  activeMembers: z.number(),
})

export type AnalyticsMetrics = {
  from: Date | null
  to: Date | null
  checkInCount: number
  eventCount: number
  prayerCount: number
  donationCount: number
  activeMembers: number
}

export const AttendanceDaySchema = z.object({
  date: z.string(), // local calendar date YYYY-MM-DD
  count: z.number(),
})

export type AttendanceDay = { date: string; count: number }

export const AttendanceSummarySchema = z.object({
  from: z.date().nullable(),
  to: z.date().nullable(),
  /** One entry per local calendar date; no person/named records. */
  days: z.array(AttendanceDaySchema),
})

export type AttendanceSummary = { from: Date | null; to: Date | null; days: AttendanceDay[] }

export const DonationTotalSchema = z.object({
  currency: z.string(),
  grossMinor: z.string(),
})

export type DonationTotal = { currency: string; grossMinor: string }

export const RegionSummarySchema = z.object({
  regionId: z.string(),
  from: z.date().nullable(),
  to: z.date().nullable(),
  churchCount: z.number(),
  memberCount: z.number(),
  activeMembers: z.number(),
  checkInCount: z.number(),
  eventCount: z.number(),
  prayerCount: z.number(),
  donationCount: z.number(),
  /** Aggregate donor gross per currency; never cross-currency sum. */
  totalGrossByCurrency: z.array(DonationTotalSchema),
})

export type RegionSummary = {
  regionId: string
  from: Date | null
  to: Date | null
  churchCount: number
  memberCount: number
  activeMembers: number
  checkInCount: number
  eventCount: number
  prayerCount: number
  donationCount: number
  totalGrossByCurrency: DonationTotal[]
}
