import { z } from 'zod'

/*
 * Pastor DTOs (Tasks 15 + 20).
 *
 * Task 15 (church route): the church route only edits church-scoped
 * assignment fields (pastoral_role, image_asset_id). Shared pastor identity
 * (name/introduction) is central-owned and rejected here by `.strict()`.
 * Gated by the church `version` (409 when stale).
 *
 * Task 20 (central route): central authority owns the shared profile
 * (name / introduction / linked user) and bulk church assignments.
 */

// --- Task 15 — church-scoped assignment patch -------------------------------

export const ChurchPastorPatchInputSchema = z
  .object({
    version: z.number().int().positive(),
    pastoral_role: z.string().trim().min(1).max(200).optional(),
    image_asset_id: z.string().uuid().nullish(),
  })
  .strict()

export type ChurchPastorPatchInput = z.infer<typeof ChurchPastorPatchInputSchema>

export const ChurchPastorSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  introduction: z.string().nullable(),
  pastoralRole: z.string(),
  imageAssetId: z.string().nullable(),
})

export interface ChurchPastorSummary {
  id: string
  name: string
  introduction: string | null
  pastoralRole: string
  imageAssetId: string | null
}

// --- Task 20 — central pastor profile + bulk assignment ---------------------

export interface PastorCreate {
  name: string
  introduction?: string | null
  userId?: string | null
}

export interface PastorUpdate {
  name?: string
  introduction?: string | null
  userId?: string | null
}

export interface ChurchPastorAssignEntry {
  pastorId: string
  pastoralRole: string
  imageAssetId?: string | null
  activeVoiceProfileId?: string | null
}

export interface ChurchPastorAssign {
  assigned: ChurchPastorAssignEntry[]
  activeVoiceProfileId?: string | null
}

// --- Task 20 — runtime validation schemas (mirror the interfaces above) -----

export const PastorCreateSchema = z.object({
  name: z.string().min(1),
  introduction: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
})

export const PastorUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    introduction: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
  })
  .refine((d) => d.name !== undefined || d.introduction !== undefined || d.userId !== undefined, {
    message: 'provide at least one field to update',
  })

export const ChurchPastorAssignSchema = z.object({
  assigned: z.array(
    z.object({
      pastorId: z.string().min(1),
      pastoralRole: z.string().min(1),
      imageAssetId: z.string().nullable().optional(),
      activeVoiceProfileId: z.string().nullable().optional(),
    }),
  ),
  activeVoiceProfileId: z.string().nullable().optional(),
})
