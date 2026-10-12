import { z } from 'zod'

/*
 * Public church picker DTOs (WB1 sign-up step 2).
 *
 * Served WITHOUT a session, so the row carries only what the picker shows:
 * id, name, city. No cover, contacts, description, status or payment data.
 */

export const ChurchOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().nullable(),
})

export type ChurchOption = z.infer<typeof ChurchOptionSchema>

export const ChurchOptionQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
})

export type ChurchOptionQuery = z.infer<typeof ChurchOptionQuerySchema>
