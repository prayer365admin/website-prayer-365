import { z } from 'zod'

/*
 * Service time DTOs (Task 14). Weekday 1-7; localTime is a wall-clock time
 * string in the church timezone. The schedule is replaced transactionally as
 * a whole, gated by the church `version` (409 when stale).
 */

export const ServiceTimeEntrySchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    localTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'localTime must be HH:MM or HH:MM:SS'),
    label: z.string().trim().max(100).optional(),
    languageCode: z.string().trim().min(1).max(10).optional(),
  })
  .strict()

export const ServiceTimeScheduleInputSchema = z
  .object({
    version: z.number().int().positive(),
    schedule: z.array(ServiceTimeEntrySchema).max(100).default([]),
  })
  .strict()

export type ServiceTimeScheduleInput = z.infer<typeof ServiceTimeScheduleInputSchema>

export const ServiceTimeEntryOutputSchema = z.object({
  id: z.string(),
  weekday: z.number(),
  localTime: z.string(),
  label: z.string().nullable(),
  languageCode: z.string().nullable(),
})

export interface ServiceTimeEntry {
  id: string
  weekday: number
  localTime: string
  label: string | null
  languageCode: string | null
}
