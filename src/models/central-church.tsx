import { z } from 'zod'
import type { ChurchStatus } from '@prisma/client'

/*
 * Central church DTOs (SPEC §8.3 / Tasks 17-18). Creation transactionally
 * writes an OrgNode (CHURCH) plus a PENDING Church. Lifecycle approve /
 * suspend / archive carry a `version` for concurrency. Removal is archive for
 * any church with history; `ChurchPurgeSchema` covers the one hard delete —
 * a never-approved church with no dependent rows (plan 020 / D-A).
 */

const coords = z
  .object({
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((d) => (d.latitude === null) === (d.longitude === null), {
    message: 'latitude and longitude must be both present or both absent',
  })

export const ChurchCreateSchema = z
  .object({
    name: z.string().min(1),
    timezone: z.string().min(1),
    parentId: z.string().optional(),
    description: z.string().optional(),
    denomination: z.string().optional(),
    church_style: z.string().optional(),
    address: z.record(z.string(), z.unknown()).optional(),
    contacts: z.record(z.string(), z.unknown()).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    sunday_live_stream: z.boolean().nullable().optional(),
    taize_chants: z.boolean().nullable().optional(),
    youth_ministry: z.boolean().nullable().optional(),
  })
  .and(coords)
export type ChurchCreate = z.infer<typeof ChurchCreateSchema>

export const ChurchUpdateSchema = z
  .object({
    version: z.number().int().positive(),
    name: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    denomination: z.string().nullable().optional(),
    church_style: z.string().nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    sunday_live_stream: z.boolean().nullable().optional(),
    taize_chants: z.boolean().nullable().optional(),
    youth_ministry: z.boolean().nullable().optional(),
  })
  .and(coords)
export type ChurchUpdate = z.infer<typeof ChurchUpdateSchema>

export const ChurchVersionSchema = z.object({
  version: z.number().int().positive(),
})
export type ChurchVersion = z.infer<typeof ChurchVersionSchema>

/**
 * Hard delete (purge) of a church. Only legal while the church is PENDING and
 * has no dependent rows; the typed name is a fat-finger guard, not a lookup.
 */
export const ChurchPurgeSchema = z.object({
  version: z.number().int().positive(),
  confirmName: z.string().trim().min(1),
})
export type ChurchPurge = z.infer<typeof ChurchPurgeSchema>

export interface ChurchSummary {
  id: string
  orgNodeId: string
  name: string
  status: ChurchStatus
  timezone: string
  description: string | null
  denomination: string | null
  church_style: string | null
  version: number
  createdAt: string
}

/** One row on the central church list (S15). */
export interface ChurchListItem extends ChurchSummary {
  /** Country registry name, when the chain reaches a COUNTRY node. */
  country: string | null
  countryCode: string | null
  /** Ancestor org nodes, outermost first (e.g. ['Diocese of X', 'Deanery Y']). */
  organization: string[]
}

/** Central church setup detail (S16 form source). */
export interface ChurchDetail {
  id: string
  orgNodeId: string
  name: string
  status: ChurchStatus
  timezone: string
  description: string | null
  denomination: string | null
  church_style: string | null
  latitude: number | null
  longitude: number | null
  sunday_live_stream: boolean | null
  taize_chants: boolean | null
  youth_ministry: boolean | null
  country: string | null
  countryCode: string | null
  organization: string[]
  approvedAt: string | null
  version: number
  createdAt: string
}
