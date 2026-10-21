import { db } from '@/utils/db-connection'

const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

export const IS_LOGIN_BLOCKED = async ({ user_id }: { user_id: string }) => {
  const attempts = await db.$queryRaw<Array<{ blocked_until: Date | null }>>`
    SELECT "blocked_until"
    FROM "auth_login_attempt"
    WHERE "user_id" = ${user_id}
  `
  const blockedUntil = attempts[0]?.blocked_until
  return Boolean(blockedUntil && blockedUntil.getTime() > Date.now())
}

export const RECORD_LOGIN_FAILURE = async ({ user_id }: { user_id: string }) => {
  const now = new Date()
  const windowCutoff = new Date(now.getTime() - WINDOW_MS)
  const blockedUntil = new Date(now.getTime() + BLOCK_MS)

  // One statement keeps concurrent failures from losing increments.
  return db.$executeRaw`
    INSERT INTO "auth_login_attempt"
      ("user_id", "failures", "window_started_at", "blocked_until", "updated_at")
    VALUES (${user_id}, 1, ${now}, NULL, ${now})
    ON CONFLICT ("user_id") DO UPDATE SET
      "failures" = CASE
        WHEN "auth_login_attempt"."window_started_at" <= ${windowCutoff} THEN 1
        ELSE "auth_login_attempt"."failures" + 1
      END,
      "window_started_at" = CASE
        WHEN "auth_login_attempt"."window_started_at" <= ${windowCutoff} THEN ${now}
        ELSE "auth_login_attempt"."window_started_at"
      END,
      "blocked_until" = CASE
        WHEN "auth_login_attempt"."window_started_at" <= ${windowCutoff} THEN NULL
        WHEN "auth_login_attempt"."failures" + 1 >= ${MAX_FAILURES} THEN ${blockedUntil}
        ELSE "auth_login_attempt"."blocked_until"
      END,
      "updated_at" = ${now}
  `
}

export const CLEAR_LOGIN_FAILURES = ({ user_id }: { user_id: string }) =>
  db.$executeRaw`DELETE FROM "auth_login_attempt" WHERE "user_id" = ${user_id}`
