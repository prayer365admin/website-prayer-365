import { z } from 'zod'

/*
 * Country / language registry DTOs (SPEC §8.3 / Task 19).
 * Rows referenced by org_nodes / church_languages / users cannot be removed.
 */

export const CountryCreateSchema = z.object({
  code: z.string().regex(/^[A-Z]{2}$/, 'code must be 2 uppercase letters'),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
})
export type CountryCreate = z.infer<typeof CountryCreateSchema>

export const CountryUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((d) => d.name !== undefined || d.enabled !== undefined, {
    message: 'provide at least one field to update',
  })
export type CountryUpdate = z.infer<typeof CountryUpdateSchema>

export const CountryCodeSchema = z.object({
  code: z.string().regex(/^[A-Z]{2}$/),
})
export type CountryCode = z.infer<typeof CountryCodeSchema>

export const LanguageCreateSchema = z.object({
  code: z.string().regex(/^[a-z]{2}(?:-[A-Za-z0-9]+)*$/, 'code must be a BCP-47 language tag'),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
})
export type LanguageCreate = z.infer<typeof LanguageCreateSchema>

export const LanguageUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((d) => d.name !== undefined || d.enabled !== undefined, {
    message: 'provide at least one field to update',
  })
export type LanguageUpdate = z.infer<typeof LanguageUpdateSchema>

export const LanguageCodeSchema = z.object({
  code: z.string().min(1),
})
export type LanguageCode = z.infer<typeof LanguageCodeSchema>
