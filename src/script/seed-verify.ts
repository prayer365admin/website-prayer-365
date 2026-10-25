/* eslint-disable no-console -- CLI gate prints its table and verdict on stdout */

import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'

import { DEMO_CHURCH_CONTENT } from '../../prisma/seeds/demo-content'
import { DEMO_MEDIA } from '../../prisma/seeds/demo-media'
import { S3_PUBLIC_URL } from '../providers/s3'
import { db } from '../utils/db-connection'
import { findDemoProblems } from './seed-verify-rules'
import type {
  ChurchReadiness,
  DemoExpectation,
  DemoReadiness,
  PrayerReadiness,
} from './seed-verify-rules'

/*
 * Demo-readiness gate. Answers one question with a pass/fail: "would the client
 * SEE the demo content — cover, gallery, service times, staff, and prayers whose
 * audio actually plays?"
 *
 *   bun run seed:verify
 *   DATABASE_URL=<client url> AWS_BUCKET_NAME=prayer365-prayer-365-media bun run seed:verify
 *
 * Exits 1 when something is missing, so it can gate a demo bring-up. Object
 * existence is checked with HEAD against the ACTIVE bucket — a URL that resolves
 * is not proof the file is there.
 */

export const DEMO_EXPECTATIONS: DemoExpectation[] = DEMO_CHURCH_CONTENT.map((c) => ({
  name: c.name,
  prayerTitles: c.prayers.map((p) => p.title),
  galleryCount: c.gallery.length,
}))

const bucket = () => process.env.AWS_BUCKET_NAME ?? process.env.S3_BUCKET ?? ''
const region = () => process.env.AWS_REGION ?? 'us-east-1'

const headObjects = async (keys: string[]): Promise<Record<string, boolean>> => {
  const b = bucket()
  if (!b || process.env.SEED_SKIP_MEDIA_UPLOAD === '1') return {}

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const sessionToken = process.env.AWS_SESSION_TOKEN
  const client = new S3Client({
    region: region(),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } }
      : {}),
  })

  const status: Record<string, boolean> = {}
  for (const key of keys) {
    try {
      await client.send(new HeadObjectCommand({ Bucket: b, Key: key }))
      status[key] = true
    } catch {
      status[key] = false
    }
  }
  return status
}

const collect = async (): Promise<DemoReadiness> => {
  const churches: ChurchReadiness[] = []
  const prayers: PrayerReadiness[] = []
  const keys = new Set<string>(DEMO_MEDIA.map((m) => m.key))

  for (const expected of DEMO_EXPECTATIONS) {
    const church = await db.church.findFirst({ where: { name: expected.name } })
    if (!church) continue

    const cover = church.cover_asset_id
      ? await db.mediaAsset.findUnique({ where: { id: church.cover_asset_id } })
      : null
    if (cover) keys.add(cover.object_key)

    const gallery = await db.churchGalleryItem.findMany({
      where: { church_id: church.id },
      orderBy: { order_index: 'asc' },
      include: { media_asset: true },
    })
    for (const item of gallery) if (item.media_asset) keys.add(item.media_asset.object_key)

    const [serviceTimes, events, announcements, pastors] = await Promise.all([
      db.serviceTime.count({ where: { church_id: church.id } }),
      db.event.count({ where: { church_id: church.id } }),
      db.announcement.count({ where: { church_id: church.id } }),
      db.churchPastor.count({ where: { church_id: church.id } }),
    ])

    churches.push({
      name: expected.name,
      coverUrl: cover ? S3_PUBLIC_URL({ key: cover.object_key }) : null,
      galleryUrls: gallery.map((g) =>
        g.media_asset ? S3_PUBLIC_URL({ key: g.media_asset.object_key }) : null,
      ),
      serviceTimes,
      events,
      announcements,
      pastors,
    })

    const rows = await db.prayerVersion.findMany({
      where: { prayer: { church_id: church.id }, title: { in: expected.prayerTitles } },
      include: {
        selected_audio: { include: { asset: true } },
        prayer: { select: { published_at: true } },
      },
    })
    for (const title of expected.prayerTitles) {
      const row = rows.find((r) => r.title === title)
      const asset = row?.selected_audio?.asset
      if (asset) keys.add(asset.object_key)
      prayers.push({
        church: expected.name,
        title,
        published: Boolean(row?.prayer.published_at),
        audioStatus: row?.selected_audio?.status ?? null,
        audioUrl: asset ? S3_PUBLIC_URL({ key: asset.object_key }) : null,
      })
    }
  }

  return {
    churches,
    prayers,
    expectations: DEMO_EXPECTATIONS,
    objectStatus: await headObjects(Array.from(keys)),
  }
}

async function main() {
  const readiness = await collect()

  console.log(`bucket: ${bucket() || '(unset — object check skipped)'}`)
  console.log('\nchurch                          cover gallery svc evt ann pastor prayers-ok')
  for (const c of readiness.churches) {
    const expected = readiness.expectations.find((e) => e.name === c.name)
    const rows = readiness.prayers.filter((p) => p.church === c.name)
    const ok = rows.filter((p) => p.published && p.audioStatus === 'APPROVED' && p.audioUrl).length
    console.log(
      `${c.name.padEnd(31)} ${(c.coverUrl ? 'yes' : 'NO ').padEnd(5)} ` +
        `${String(c.galleryUrls.length).padStart(2)}/${String(expected?.galleryCount ?? 0).padEnd(5)} ` +
        `${String(c.serviceTimes).padStart(3)} ${String(c.events).padStart(3)} ` +
        `${String(c.announcements).padStart(3)} ${String(c.pastors).padStart(6)} ` +
        `${String(ok).padStart(2)}/${String(rows.length).padStart(2)}`,
    )
  }

  console.log('\nprayer audio URLs')
  for (const p of readiness.prayers) {
    console.log(
      `  ${p.published ? 'pub' : 'DRAFT'} ${(p.audioStatus ?? 'NONE').padEnd(9)} ${p.church} / ${p.title}`,
    )
    if (p.audioUrl) console.log(`        ${p.audioUrl}`)
  }

  const checked = Object.keys(readiness.objectStatus).length
  if (checked > 0) {
    const missing = Object.entries(readiness.objectStatus).filter(([, ok]) => !ok)
    console.log(`\nmedia objects checked: ${checked} | missing: ${missing.length}`)
    for (const [key] of missing) console.log(`  MISSING ${key}`)
  }

  const problems = findDemoProblems(readiness)
  if (problems.length > 0) {
    console.log(`\nNOT DEMO-READY — ${problems.length} problem(s):`)
    for (const problem of problems) console.log(`  - ${problem}`)
    process.exitCode = 1
    return
  }
  console.log('\nDEMO-READY: every seeded church and prayer has playable, published content.')
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
