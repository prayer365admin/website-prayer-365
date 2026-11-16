/* eslint-disable no-console -- ops CLI: the plan and the result go to stdout */

import { seedGeneralPrayers } from '../../prisma/seeds/general-prayer'
import { db } from '../utils/db-connection'

/*
 * Narrow production seed for the platform daily prayer (general prayer cycle).
 *
 * `bunx tsx prisma/seed.ts` seeds the WHOLE demo dataset — churches, demo users,
 * media — and must never run against the client database. This script touches
 * only two things:
 *
 *   1. `general_prayers`: the 10 cycle rows (upsert by `sequence`, so re-running
 *      refreshes copy and never duplicates a day).
 *   2. the `general_prayer` notification rule: the send job fails with
 *      `MISSING_RULE` when the row is absent, and stops silently when `enabled`
 *      is false. The client asked for push AND email on this trigger.
 *
 *   bun src/script/seed-general-prayers.ts            # read-only: report + plan
 *   bun src/script/seed-general-prayers.ts --apply    # upsert rows + rule
 */

const APPLY = process.argv.includes('--apply')

const report = async () => {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host
    } catch {
      return '(unparseable DATABASE_URL)'
    }
  })()
  const rows = await db.generalPrayer.count()
  const active = await db.generalPrayer.count({ where: { is_active: true } })
  const rule = await db.notificationRule.findUnique({ where: { type: 'general_prayer' } })
  const legacy = await db.notificationRule.findUnique({ where: { type: 'daily_prayer' } })

  console.log(`target      : ${host}`)
  console.log(`general     : ${rows} row(s), ${active} active`)
  console.log(
    `rule        : ${
      rule
        ? `present (enabled=${rule.enabled} push=${rule.push_enabled} email=${rule.email_enabled})`
        : 'MISSING -> the send job fails with MISSING_RULE'
    }`,
  )
  if (legacy) {
    console.log(
      `note        : a legacy 'daily_prayer' rule exists (enabled=${legacy.enabled}); the sender looks up 'general_prayer'`,
    )
  }
  return { rows, rule }
}

const run = async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

  const before = await report()

  if (!APPLY) {
    console.log('\nDRY RUN — nothing was written. Re-run with --apply to seed.')
    return
  }

  await seedGeneralPrayers()

  const rule = {
    type: 'general_prayer',
    enabled: true,
    push_enabled: true,
    email_enabled: true,
  }
  await db.notificationRule.upsert({
    where: { type: rule.type },
    create: rule,
    // Copy the channel switches only; an operator may have disabled the type on
    // purpose, and a re-seed must not turn announcements back on.
    update: { push_enabled: rule.push_enabled, email_enabled: rule.email_enabled },
  })

  console.log('')
  await report()
  console.log(
    `\napplied     : ${before.rows} -> ${await db.generalPrayer.count()} row(s); rule 'general_prayer' ensured`,
  )
  console.log(
    'next        : narration needs ELEVENLABS_GENERAL_PRAYER_VOICE_ID + one `general_prayer.audio` job per row;',
  )
  console.log('              without it the public pages stay text-only (audioUrl is null).')
}

run()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exit(1)
  })
