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
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  pastoralRole: z.string(),
  imageAssetId: z.string().nullable(),
  activeVoiceProfileId: z.string().nullable(),
  voiceReady: z.boolean(),
  profileImageAssetId: z.string().nullable(),
  resolvedImageAssetId: z.string().nullable(),
})

export interface ChurchPastorSummary {
  id: string
  name: string
  introduction: string | null
  user: { id: string; name: string; email: string } | null
  pastoralRole: string
  /** Optional image override owned by this ChurchPastor relationship. */
  imageAssetId: string | null
  activeVoiceProfileId: string | null
  voiceReady: boolean
  /** Canonical image owned by the shared Pastor profile. */
  profileImageAssetId: string | null
  /** Church override, then canonical profile image. */
  resolvedImageAssetId: string | null
}

// --- Task 20 — central pastor profile + bulk assignment ---------------------

export interface PastorCreate {
  name: string
  introduction?: string | null
  userId?: string | null
}

export interface PastorData {
  id: string
  version: number
  name: string
  introduction: string | null
  imageAssetId: string | null
  imageChurchId: string | null
  user_id: string | null
  user?: {
    id: string
    name: string
    email: string
  } | null
  churches: PastorChurchAssignment[]
}

export interface PastorChurchAssignment {
  churchId: string
  churchName: string
}

export interface PastorFormModel {
  name: string
  introduction?: string | null
  imageAssetId?: string | null
  /** Client-only upload ownership context; never sent to the Pastor API. */
  imageChurchId?: string | null
  userId?: string | null
  assignments?: Array<{
    churchId: string
  }>
}

export interface PastorUpdate {
  version: number
  name?: string
  introduction?: string | null
  imageAssetId?: string | null
  userId?: string | null
}

export interface ChurchPastorAssignEntry {
  pastorId: string
  pastoralRole?: string
  imageAssetId?: string | null
  activeVoiceProfileId?: string | null
}

export interface ChurchPastorAssign {
  assigned: ChurchPastorAssignEntry[]
  activeVoiceProfileId?: string | null
}

// --- Task 20 — runtime validation schemas (mirror the interfaces above) -----

export const PastorCreateSchema = z
  .object({
    name: z.string().min(1),
    introduction: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
  })
  .strict()

export const PastorUpdateSchema = z
  .object({
    version: z.number().int().positive(),
    name: z.string().min(1).optional(),
    introduction: z.string().nullable().optional(),
    imageAssetId: z.string().uuid().nullable().optional(),
    userId: z.string().nullable().optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.name !== undefined ||
      d.introduction !== undefined ||
      d.imageAssetId !== undefined ||
      d.userId !== undefined,
    { message: 'provide at least one profile field to update' },
  )

export const ChurchPastorAssignSchema = z
  .object({
    assigned: z.array(
      z.object({
        pastorId: z.string().uuid(),
        pastoralRole: z.string().min(1).optional(),
        imageAssetId: z.string().uuid().nullable().optional(),
        activeVoiceProfileId: z.string().uuid().nullable().optional(),
      }),
    ),
    activeVoiceProfileId: z.string().uuid().nullable().optional(),
  })
  .superRefine(({ assigned }, ctx) => {
    const seen = new Set<string>()
    assigned.forEach(({ pastorId }, index) => {
      if (seen.has(pastorId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assigned', index, 'pastorId'],
          message: 'A pastor can only be assigned once.',
        })
      }
      seen.add(pastorId)
    })
  })
