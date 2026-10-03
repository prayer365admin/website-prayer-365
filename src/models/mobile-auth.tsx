import { z } from 'zod'

/*
 * Mobile auth / token contract DTOs (SPEC §3.1 / D1 / TASK X-07, MB-01).
 *
 * The auth endpoints are intentionally NOT behind required-auth (they are the
 * token issuance point). They use the existing User identity + password
 * verification and exchange short-lived access JWTs + opaque hashed refresh
 * tokens (rotation + family reuse-revocation).
 */

export const MobileLoginRequestSchema = z
  .object({
    email: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(200),
    installationId: z.string().trim().min(1).max(200),
  })
  .strict()

export type MobileLoginRequest = z.infer<typeof MobileLoginRequestSchema>

export const MobileRefreshRequestSchema = z
  .object({
    refreshToken: z.string().trim().min(1).max(500),
    installationId: z.string().trim().min(1).max(200),
  })
  .strict()

export type MobileRefreshRequest = z.infer<typeof MobileRefreshRequestSchema>

export const MobileLogoutRequestSchema = z
  .object({
    refreshToken: z.string().trim().min(1).max(500),
  })
  .strict()

export type MobileLogoutRequest = z.infer<typeof MobileLogoutRequestSchema>

/**
 * Safe user identity returned with a successful login. Never includes the
 * password hash or any session / device internals.
 */
export const MobileUserDTOSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  authVersion: z.number(),
})

export type MobileUserDTO = z.infer<typeof MobileUserDTOSchema>

export const MobileTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(), // access-token lifetime, seconds (15 min)
  user: MobileUserDTOSchema,
})

export type MobileTokenResponse = z.infer<typeof MobileTokenResponseSchema>

export const MobileForgotPasswordRequestSchema = z
  .object({
    email: z.string().trim().min(1).max(254),
  })
  .strict()

export type MobileForgotPasswordRequest = z.infer<typeof MobileForgotPasswordRequestSchema>

export const MobileResetPasswordRequestSchema = z
  .object({
    token: z.string().trim().min(1),
    new_password: z.string().min(1),
    confirm_password: z.string().min(1),
  })
  .strict()

export type MobileResetPasswordRequest = z.infer<typeof MobileResetPasswordRequestSchema>
