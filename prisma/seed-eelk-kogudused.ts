/* eslint-disable no-console -- CLI reports its plan on stdout */
/*
 * EELK congregation seed (plan 042). Phases:
 *   --enrich   build prisma/import/eelk-kogudused.json (network: wikipedia, nominatim, commons)
 *   --dry-run  print what would be created / updated / untouched, write nothing
 *   --apply    write church rows into the target DB (PROD host guard)
 *   --images   upload cover + gallery photos and attach them
 *   --rollback=<result.json>  undo a rows or images run
 */
import 'dotenv/config'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Prisma } from '@prisma/client'
import {
  buildSeedChurches,
  type EnrichmentEntry,
  type SeedChurch,
  type SeedFile,
} from '../src/script/eelk-seed/dataset'
import { findCoordinates, nameTokens, USER_AGENT } from '../src/script/eelk-seed/enrich'
import { EELK_DIRECTORY_URL, parseDirectory } from '../src/script/eelk-seed/parse'
import { commonsPhotos } from '../src/script/eelk-seed/photos'
import { NO_EELK_ROW_SLUGS } from '../src/script/eelk-seed/rules'
import type { ExistingChurch } from '../src/script/eelk-seed/writes'

const FIXTURES = '.hermes/fixtures/eelk-seed'
const PAGE = `${FIXTURES}/inc-kogudused.html`
const OVERRIDES = `${FIXTURES}/coord-overrides.json`
const DATA = 'prisma/import/eelk-kogudused.json'
const EXPECTED_DB_HOST_FRAGMENT = 'prayer365-prayer-365-data-postgres'

const args = new Set(process.argv.slice(2))
const argValue = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
const only = argValue('only')
const rollbackFile = argValue('rollback')
const mode = ['--enrich', '--dry-run', '--apply', '--images'].find((name) => args.has(name)) ?? ''

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T
const writeJson = (file: string, value: unknown) => {
  mkdirSync(FIXTURES, { recursive: true })
  writeFileSync(resolve(file), JSON.stringify(value, null, 1))
}
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

interface Override {
  lat?: number | null
  lng?: number | null
  source?: string
}

const overrides = (): Record<string, Override> =>
  existsSync(OVERRIDES) ? readJson<Record<string, Override>>(OVERRIDES) : {}

const loadPage = async (): Promise<string> => {
  if (existsSync(PAGE)) return readFileSync(PAGE, 'utf8')
  const response = await fetch(EELK_DIRECTORY_URL, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`HTTP_${response.status} ${EELK_DIRECTORY_URL}`)
  const html = await response.text()
  writeJson(PAGE, html)
  return html
}

const loadSeed = (): SeedFile => readJson<SeedFile>(DATA)
const loadWrites = async () => await import('../src/script/eelk-seed/writes')
const loadDb = async () => (await import('../src/utils/db-connection')).db

const assertTarget = () => {
  const url = process.env.DATABASE_URL ?? ''
  const host = url.replace(/:\/\/[^@]*@/, '://***@').replace(/\?.*$/, '')
  if (!url.includes(EXPECTED_DB_HOST_FRAGMENT)) {
    throw new Error(`refusing to run: DATABASE_URL does not point at PROD (${host})`)
  }
  console.log(`db: ${host}`)
}

const runEnrich = async () => {
  const rows = parseDirectory(await loadPage())
  const placeCount = new Map<string, number>()
  for (const row of rows) {
    const place = nameTokens(row.name)[0] ?? row.name
    placeCount.set(place, (placeCount.get(place) ?? 0) + 1)
  }
  const fileOverrides = overrides()
  const enrichment: Record<string, EnrichmentEntry> = {}
  let withCoords = 0
  let withPhotos = 0
  for (const row of rows) {
    const place = nameTokens(row.name)[0] ?? row.name
    const coordinates = await findCoordinates({
      churchName: row.name,
      address: row.churchAddressLine ?? row.addressLine,
      override: fileOverrides[row.regCode] ?? null,
      uniquePlace: (placeCount.get(place) ?? 1) === 1,
    })
    const photos = await commonsPhotos(row.name, {
      uniquePlace: (placeCount.get(place) ?? 1) === 1,
    })
    if (coordinates) withCoords += 1
    if (photos.length > 0) withPhotos += 1
    enrichment[row.regCode] = { coordinates, photos }
    console.log(
      `${String(row.order).padStart(3)} ${row.name.slice(0, 34).padEnd(34)} ` +
        `coords=${coordinates ? coordinates.source.slice(0, 32) : 'MISSING'} photos=${photos.length}`,
    )
  }
  const file: SeedFile = {
    generatedAt: new Date().toISOString(),
    source: EELK_DIRECTORY_URL,
    churches: buildSeedChurches(rows, enrichment),
  }
  writeJson(DATA, file)
  writeJson(
    `${FIXTURES}/credits.json`,
    file.churches.flatMap((church) =>
      church.photos.map((photo) => ({
        church: church.name,
        regCode: church.regCode,
        ...photo,
      })),
    ),
  )
  console.log(`\nchurches ${rows.length} · coords ${withCoords} · photos ${withPhotos} -> ${DATA}`)
}

interface PlanRow {
  church: SeedChurch
  existing: ExistingChurch | null
}

const normalise = (value: string): string =>
  value.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()

const buildPlan = async (seed: SeedFile) => {
  const writes = await loadWrites()
  const all = await writes.readAllChurches()
  const bySlug = new Map(all.map((row) => [row.slug, row]))
  const byName = new Map(all.map((row) => [normalise(row.name), row]))
  const byEmail = new Map(all.filter((row) => row.email).map((row) => [row.email as string, row]))
  const protectedSlugs = new Set<string>(NO_EELK_ROW_SLUGS)
  const plan: PlanRow[] = seed.churches.map((church) => {
    const email = church.contacts.email?.toLowerCase()
    const candidate =
      (church.existingSlug ? bySlug.get(church.existingSlug) : undefined) ??
      (email ? byEmail.get(email) : undefined) ??
      byName.get(normalise(church.name)) ??
      null
    // A shared parish email (narva@eelk.ee) must not merge two different congregations.
    const existing = candidate && protectedSlugs.has(candidate.slug) ? null : candidate
    return { church, existing }
  })
  const matchedSlugs = new Set(
    plan.map((row) => row.existing?.slug).filter((slug): slug is string => Boolean(slug)),
  )
  return { plan, matchedSlugs }
}

const runDryRun = async () => {
  assertTarget()
  const seed = loadSeed()
  const { plan, matchedSlugs } = await buildPlan(seed)
  const created = plan.filter((row) => !row.existing)
  const updated = plan.filter((row) => row.existing)
  const missingCoords = plan.filter((row) => !row.church.coordinates)
  const missingPhotos = plan.filter((row) => row.church.photos.length === 0)
  const noRow = NO_EELK_ROW_SLUGS.filter((slug) => !matchedSlugs.has(slug))
  console.log(
    `create ${created.length} · update ${updated.length} · untouched ${noRow.length} · ` +
      `coords missing ${missingCoords.length} · photos missing ${missingPhotos.length}`,
  )
  for (const row of updated) console.log(`  UPDATE ${row.existing?.slug} <- ${row.church.name}`)
  for (const slug of noRow) console.log(`  UNTOUCHED ${slug} (no EELK row)`)
  writeFileSync(
    resolve(FIXTURES, 'report.md'),
    [
      '# EELK seed dry-run',
      '',
      `- create: ${created.length}`,
      `- update: ${updated.length}`,
      `- untouched: ${noRow.length}`,
      `- coordinates missing: ${missingCoords.length}`,
      `- photos missing: ${missingPhotos.length}`,
      '',
      '## No coordinates',
      ...missingCoords.map((row) => `- ${row.church.name} (${row.church.regCode})`),
      '',
      '## No photo',
      ...missingPhotos.map((row) => `- ${row.church.name} (${row.church.regCode})`),
      '',
      '## Untouched (no EELK row)',
      ...noRow.map((slug) => `- ${slug}`),
    ].join('\n'),
  )
  console.log(`report: ${FIXTURES}/report.md`)
}

const runApply = async () => {
  assertTarget()
  const seed = loadSeed()
  const writes = await loadWrites()
  const { plan, matchedSlugs } = await buildPlan(seed)
  if (matchedSlugs.size < 20) {
    throw new Error(`only ${matchedSlugs.size} existing churches matched — refusing to apply`)
  }
  const context = await writes.resolveContext()
  const tag = stamp()
  const backupPath = resolve(FIXTURES, `backup-${tag}.json`)
  const resultPath = resolve(FIXTURES, `result-${tag}.json`)
  const touched = plan.map((row) => row.existing?.id).filter((id): id is string => Boolean(id))
  writeJson(backupPath, await writes.readBackup(touched))
  console.log(`backup: ${backupPath} (${touched.length} churches)`)

  const deaneries = new Map<string, string>()
  for (const name of Array.from(new Set(plan.map((row) => row.church.deaneryNode)))) {
    deaneries.set(name, await writes.ensureDeanery({ name, parentId: context.dioceseId }))
  }

  const createdIds: string[] = []
  const createdOrgNodeIds: string[] = []
  const updatedIds: string[] = []
  for (const row of plan) {
    if (only && row.church.existingSlug !== only && row.existing?.slug !== only) continue
    if (row.existing) {
      await writes.updateChurch({ church: row.church, existing: row.existing })
      updatedIds.push(row.existing.id)
      console.log(`  updated ${row.existing.slug} <- ${row.church.name}`)
    } else {
      const deaneryId = deaneries.get(row.church.deaneryNode)
      if (!deaneryId) throw new Error(`deanery node missing for ${row.church.name}`)
      const result = await writes.createChurch({ church: row.church, context, deaneryId })
      createdIds.push(result.churchId)
      createdOrgNodeIds.push(result.orgNodeId)
      console.log(`  created ${result.slug}`)
    }
  }
  writeJson(resultPath, {
    phase: 'rows',
    finishedAt: new Date().toISOString(),
    backupPath,
    createdIds,
    createdOrgNodeIds,
    updatedIds,
  })
  console.log(
    `\ncreated ${createdIds.length} · updated ${updatedIds.length} · result ${resultPath}`,
  )
}

const runImages = async () => {
  assertTarget()
  const seed = loadSeed()
  const writes = await loadWrites()
  const { plan } = await buildPlan(seed)
  const resultPath = resolve(FIXTURES, `result-images-${stamp()}.json`)
  const assets: unknown[] = []
  const failures: { slug: string; error: string }[] = []

  for (const row of plan) {
    if (!row.existing) throw new Error(`${row.church.name} has no church row — run --apply first`)
    if (only && row.existing.slug !== only) continue
    if (row.church.photos.length === 0) continue
    try {
      const written = await writes.replacePhotos({
        church: row.church,
        churchId: row.existing.id,
      })
      assets.push({ slug: row.existing.slug, assets: written })
      console.log(`  ${row.existing.slug}: cover + ${Math.max(0, written.length - 1)} gallery`)
    } catch (error) {
      failures.push({ slug: row.existing.slug, error: (error as Error).message })
      console.log(`  FAILED ${row.existing.slug}: ${(error as Error).message}`)
    }
  }
  writeJson(resultPath, { phase: 'images', assets, failures })
  console.log(
    `\nchurches with new photos ${assets.length} · failures ${failures.length} · ${resultPath}`,
  )
  if (failures.length > 0) process.exitCode = 1
}

interface BackupChurch {
  id: string
  name: string
  description: string | null
  address: unknown
  contacts: unknown
  website: string | null
  social_links: unknown
  status: string
  latitude: unknown
  longitude: unknown
  cover_asset_id: string | null
  hero_asset_id: string | null
  org_node_id: string
  serviceTimes: {
    weekday: number
    local_time: Date
    label: string | null
    language_code: string | null
  }[]
}

const runRollback = async (file: string) => {
  assertTarget()
  const db = await loadDb()
  const snapshot = readJson<{
    phase: 'rows' | 'images'
    backupPath?: string
    createdIds?: string[]
    createdOrgNodeIds?: string[]
    assets?: { key: string; assetId: string; churchId: string; kind: string; previous?: unknown }[]
  }>(file)

  if (snapshot.phase === 'images') {
    for (const asset of snapshot.assets ?? []) {
      await db.mediaAsset.deleteMany({ where: { id: asset.assetId } })
    }
    console.log(`rollback images: ${snapshot.assets?.length ?? 0} asset rows removed`)
    return
  }

  const createdIds = snapshot.createdIds ?? []
  if (createdIds.length > 0) {
    await db.serviceTime.deleteMany({ where: { church_id: { in: createdIds } } })
    await db.churchLanguage.deleteMany({ where: { church_id: { in: createdIds } } })
    await db.churchGalleryItem.deleteMany({ where: { church_id: { in: createdIds } } })
    await db.mediaAsset.deleteMany({ where: { church_id: { in: createdIds } } })
    await db.church.deleteMany({ where: { id: { in: createdIds } } })
    await db.orgNode.deleteMany({ where: { id: { in: snapshot.createdOrgNodeIds ?? [] } } })
  }

  if (snapshot.backupPath) {
    const backup = readJson<BackupChurch[]>(snapshot.backupPath)
    for (const row of backup) {
      await db.serviceTime.deleteMany({ where: { church_id: row.id } })
      await db.church.update({
        where: { id: row.id },
        data: {
          name: row.name,
          description: row.description,
          address: row.address as Prisma.InputJsonValue,
          contacts: row.contacts as Prisma.InputJsonValue,
          website: row.website,
          social_links: row.social_links as Prisma.InputJsonValue,
          status: row.status as never,
          cover_asset_id: row.cover_asset_id,
          hero_asset_id: row.hero_asset_id,
          ...(row.latitude === null ? { latitude: null, longitude: null } : {}),
        },
      })
      for (const time of row.serviceTimes) {
        await db.serviceTime.create({
          data: {
            church_id: row.id,
            weekday: time.weekday,
            local_time: time.local_time,
            label: time.label,
            language_code: time.language_code,
          },
        })
      }
    }
  }
  console.log(
    `rollback rows: ${createdIds.length} churches removed · ${snapshot.backupPath ? 'backup restored' : 'no backup'}`,
  )
}

const main = async () => {
  if (rollbackFile) {
    await runRollback(rollbackFile)
    return
  }
  if (!mode) {
    console.log(
      'usage: bunx tsx prisma/seed-eelk-kogudused.ts --enrich|--dry-run|--apply|--images|--rollback=<file>',
    )
    return
  }
  if (mode === '--enrich') {
    await runEnrich()
    return
  }
  if (mode === '--dry-run') {
    await runDryRun()
    return
  }
  if (mode === '--apply') {
    await runApply()
    return
  }
  await runImages()
}

main().catch((error) => {
  console.log(error)
  process.exit(1)
})
