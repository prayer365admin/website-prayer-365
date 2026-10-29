/* eslint-disable no-console -- CLI script reports its upload plan on stdout */

import { db } from '../utils/db-connection'
import { DEMO_MEDIA, ensureDemoMedia } from '../../prisma/seeds/demo-media'

/*
 * Uploads the demo media objects into the ACTIVE bucket (AWS_BUCKET_NAME) and
 * prints the keys. Idempotent: an object that already exists is left untouched.
 *
 *   bun run seed:media
 *   AWS_BUCKET_NAME=prayer365-prayer-365-media AWS_PROFILE=prayer-365 bun run seed:media
 *   SEED_SKIP_MEDIA_UPLOAD=1 bun run seed:media   # list only, no network
 */
async function main() {
  const bucket = process.env.AWS_BUCKET_NAME ?? process.env.S3_BUCKET ?? ''
  console.log(`bucket: ${bucket || '(unset — uploads will be skipped)'}`)
  console.log(`files:  ${DEMO_MEDIA.length}`)

  const results = await ensureDemoMedia()
  for (const r of results) console.log(`  ${r.status.padEnd(8)} ${r.key}  ${r.url ?? ''}`)

  const uploaded = results.filter((r) => r.status === 'uploaded').length
  const present = results.filter((r) => r.status === 'present').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  console.log(`uploaded: ${uploaded} | already present: ${present} | skipped: ${skipped}`)
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (e) => {
    console.log(e)
    await db.$disconnect()
    process.exit(1)
  })
