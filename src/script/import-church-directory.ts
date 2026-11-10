/* eslint-disable no-console -- CLI script reports its import plan on stdout */
/*
 * Estonian church directory import (plan 037).
 *
 *   bunx tsx src/script/import-church-directory.ts --collect-sources
 *   bunx tsx src/script/import-church-directory.ts --enrich
 *   bunx tsx src/script/import-church-directory.ts --check-descriptions
 *   bunx tsx src/script/import-church-directory.ts --dry-run
 *   bunx tsx src/script/import-church-directory.ts --apply
 *   bunx tsx src/script/import-church-directory.ts --images
 *   bunx tsx src/script/import-church-directory.ts --rollback=<result.json> [--rollback=<result2.json>]
 *
 * Everything that writes to PROD carries `DOTENV_CONFIG_PATH=.env.prod` on the
 * command line; `src/utils/db-connection.ts` loads it and the target host is
 * asserted below before any write.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { db } from '../utils/db-connection'
import { S3_DELETE_OBJECT } from '../providers/s3'
import {
  buildChurchPlans,
  groupPastors,
  parseRows,
  WIKI_TERM_BY_ORDER,
  cityFor,
  type ChurchPlan,
  type PastorPlan,
} from './church-directory-import/rules'
import {
  eelkRowFor,
  loadEelkDocument,
  osmCentroid,
  parishAboutText,
  serviceSentenceFrom,
  sleep as enrichSleep,
  socialLinksFrom,
  wikiSummary,
  type SourceText,
} from './church-directory-import/enrich'
import {
  parseServiceSentence,
  type ParsedServiceTime,
} from './church-directory-import/service-times'
import {
  attachChurchImage,
  attachPastorImage,
  createChurch,
  createReadyImageAsset,
  findExistingChurch,
  linkPastor,
  readBackup,
  resolveImportContext,
  updateChurch,
  type ChurchWriteInput,
} from './church-directory-import/db-writes'
import { transferImage, webFriendlyUrl } from './church-directory-import/images'

const CSV_JSON = 'prisma/import/church-directory.json'
const FIXTURES = '.hermes/fixtures/church-directory'
const ENRICHED = `${FIXTURES}/enriched.json`
const DESCRIPTIONS = `${FIXTURES}/descriptions.json`
const DESCRIPTION_SOURCES = `${FIXTURES}/description-sources.json`
const COORD_OVERRIDES = `${FIXTURES}/coord-overrides.json`
const IMAGE_OVERRIDES = `${FIXTURES}/image-overrides.json`

const EXPECTED_DB_HOST_FRAGMENT = 'prayer365-prayer-365-data-postgres'

const args = new Set(process.argv.slice(2))
const argValues = (name: string) =>
  process.argv.filter((arg) => arg.startsWith(`--${name}=`)).map((arg) => arg.split('=')[1])
const only = argValues('only').at(0)
/** Retry a single slot without touching the other: --kind=church | --kind=pastor */
const kindFilter = argValues('kind').at(0)
const rollbackFiles = argValues('rollback')
const mode =
  ['--collect-sources', '--check-descriptions', '--enrich'].find((name) => args.has(name)) ??
  (args.has('--images') ? '--images' : args.has('--apply') ? '--apply' : '--dry-run')

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T
const writeJson = (file: string, value: unknown) => {
  mkdirSync(FIXTURES, { recursive: true })
  writeFileSync(resolve(file), JSON.stringify(value, null, 1))
}

interface EnrichmentEntry {
  churchName: string
  existing: boolean
  coordinates: { lat: number; lng: number; source: string } | null
  socialLinks: { url: string; label: string }[]
  socialSource: string
  serviceSentence: string
  serviceTimes: ParsedServiceTime[]
  serviceTimeFlagged: string[]
  description: string | null
  descriptionSources: string[]
}

interface Enrichment {
  generatedAt: string
  eelkSource: string
  churches: Record<string, EnrichmentEntry>
  flagged: { order: string; field: string; clause: string }[]
}

const loadRows = () => parseRows(readJson<Record<string, string>[]>(CSV_JSON))

const loadEnrichment = (): Enrichment => {
  if (!existsSync(ENRICHED)) {
    throw new Error(`${ENRICHED} is missing — run --enrich first`)
  }
  return readJson<Enrichment>(ENRICHED)
}

const coordOverrides = () =>
  existsSync(COORD_OVERRIDES)
    ? readJson<Record<string, { lat?: number | null; lng?: number | null }>>(COORD_OVERRIDES)
    : {}

const imageOverrides = () =>
  existsSync(IMAGE_OVERRIDES)
    ? readJson<Record<string, { church?: string; pastor?: string }>>(IMAGE_OVERRIDES)
    : {}

const assertTarget = () => {
  const url = process.env.DATABASE_URL ?? ''
  const host = url.replace(/:\/\/[^@]*@/, '://***@').replace(/\?.*$/, '')
  if (!url.includes(EXPECTED_DB_HOST_FRAGMENT)) {
    throw new Error(
      `refusing to run: DATABASE_URL does not point at the PROD RDS instance (${host})`,
    )
  }
  console.log(`db:      ${host}`)
  console.log(`bucket:  ${process.env.AWS_BUCKET_NAME ?? process.env.S3_BUCKET ?? '(unset)'}`)
  console.log(`region:  ${process.env.AWS_REGION ?? '(unset)'}`)
}

/** --collect-sources: wiki + parish text per row, rendered into description-sources.json. */
const collectSources = async () => {
  const rows = loadRows()
  const bundle: Record<
    string,
    { churchName: string; wiki: SourceText | null; parish: SourceText | null }
  > = {}
  let wikiCount = 0
  let parishCount = 0
  for (const row of rows) {
    const order = row.directory_order
    const override = WIKI_TERM_BY_ORDER[order]
    const wiki = override
      ? await wikiSummary(override, row.church_name, cityFor(order))
      : await wikiSummary(row.congregation_name, row.church_name, cityFor(order))
    await enrichSleep(250)
    const parish = await parishAboutText(row.parish_url?.trim() || null)
    await enrichSleep(250)
    if (wiki) wikiCount += 1
    if (parish) parishCount += 1
    bundle[order] = { churchName: row.church_name, wiki, parish }
    console.log(
      `${order.padStart(2)} ${row.church_name.slice(0, 32).padEnd(32)} wiki=${wiki?.source ?? 'MISSING'} parish=${parish ? 'yes' : '-'}`,
    )
  }
  writeJson(DESCRIPTION_SOURCES, bundle)
  console.log(
    `\ncollected: wiki ${wikiCount}/${rows.length}, parish ${parishCount}/${rows.length} -> ${DESCRIPTION_SOURCES}`,
  )
}

/** --check-descriptions: no placeholder, no invented year, sane length. */
const checkDescriptions = () => {
  const sources =
    readJson<Record<string, { wiki: SourceText | null; parish: SourceText | null }>>(
      DESCRIPTION_SOURCES,
    )
  const drafts = readJson<Record<string, string>>(DESCRIPTIONS)
  const problems: string[] = []
  for (const [order, text] of Object.entries(drafts)) {
    if (text.length < 240 || text.length > 600) problems.push(`${order}: length ${text.length}`)
    if (!text.trim().endsWith('.')) problems.push(`${order}: no closing period`)
    if (/lorem|tbd|todo|placeholder/i.test(text)) problems.push(`${order}: placeholder text`)
    const haystack = [sources[order]?.wiki?.text ?? '', sources[order]?.parish?.text ?? ''].join(
      ' ',
    )
    for (const year of text.match(/\b1[6-9]\d{2}\b|\b20\d{2}\b/g) ?? []) {
      if (!haystack.includes(year)) problems.push(`${order}: year ${year} not found in any source`)
    }
  }
  console.log(
    problems.length
      ? problems.join('\n')
      : `descriptions OK (${Object.keys(drafts).length} entries)`,
  )
  if (problems.length) process.exit(1)
}

/** --enrich: merge coordinates, socials, service times and descriptions into enriched.json. */
const enrich = async () => {
  const rows = loadRows()
  const descriptions = existsSync(DESCRIPTIONS)
    ? readJson<Record<string, string>>(DESCRIPTIONS)
    : {}
  const sources = existsSync(DESCRIPTION_SOURCES)
    ? readJson<Record<string, { wiki: SourceText | null; parish: SourceText | null }>>(
        DESCRIPTION_SOURCES,
      )
    : {}
  const document = await loadEelkDocument()
  const churches: Record<string, EnrichmentEntry> = {}
  const flagged: Enrichment['flagged'] = []

  for (const row of rows) {
    const order = row.directory_order
    const tr = eelkRowFor(document, row.church_email)
    if (!tr)
      throw new Error(
        `EELK row not found for ${row.church_name} (${row.church_email}) — page markup changed?`,
      )

    let coordinates: EnrichmentEntry['coordinates'] = null
    try {
      coordinates = await osmCentroid(row.building_map_url)
    } catch (error) {
      console.log(`  ! ${order} coordinates failed: ${(error as Error).message}`)
    }

    const sentence = serviceSentenceFrom(tr)
    const parsed = parseServiceSentence(sentence)
    for (const clause of parsed.flagged) {
      flagged.push({ order, field: 'serviceTimes', clause })
    }

    const entry: EnrichmentEntry = {
      churchName: row.church_name,
      existing: true,
      coordinates,
      socialLinks: socialLinksFrom(tr),
      socialSource: 'https://eelk.ee/inc.kogudused.php',
      serviceSentence: sentence,
      serviceTimes: parsed.times,
      serviceTimeFlagged: parsed.flagged,
      description: descriptions[order] ?? null,
      descriptionSources: [sources[order]?.wiki?.source, sources[order]?.parish?.source].filter(
        (value): value is string => Boolean(value),
      ),
    }
    churches[order] = entry
    await enrichSleep(150)
  }

  const payload: Enrichment = {
    generatedAt: new Date().toISOString(),
    eelkSource: 'https://eelk.ee/inc.kogudused.php',
    churches,
    flagged,
  }
  writeJson(ENRICHED, payload)

  const coverage = (predicate: (entry: EnrichmentEntry) => boolean) =>
    `${rows.filter((row) => predicate(churches[row.directory_order])).length}/${rows.length}`
  console.log('enrichment coverage (all 25 rows)')
  console.log(`  coordinates   ${coverage((entry) => Boolean(entry.coordinates))}`)
  console.log(`  social links  ${coverage((entry) => entry.socialLinks.length > 0)}`)
  console.log(`  service times ${coverage((entry) => entry.serviceTimes.length > 0)}`)
  console.log(`  descriptions  ${coverage((entry) => Boolean(entry.description))}`)
  if (flagged.length) {
    console.log('  flagged (not written):')
    for (const item of flagged) console.log(`    ${item.order} ${item.field}: ${item.clause}`)
  }
  console.log(`\nwrote ${ENRICHED}`)
}

const resolveWork = async (plans: ChurchPlan[], existingOnly = false) => {
  const work: { plan: ChurchPlan; existing: Awaited<ReturnType<typeof findExistingChurch>> }[] = []
  for (const plan of plans) {
    const existing = await findExistingChurch({
      normalisedName: plan.normalisedName,
      aliasSlug: plan.existingSlug,
    })
    if (existingOnly && !existing) continue
    work.push({ plan, existing })
  }
  return work
}

const inputForPlan = (plan: ChurchPlan, entry: EnrichmentEntry | undefined): ChurchWriteInput => {
  const overrides = coordOverrides()
  const lat = overrides[plan.order]?.lat ?? entry?.coordinates?.lat ?? plan.latitude
  const lng = overrides[plan.order]?.lng ?? entry?.coordinates?.lng ?? plan.longitude
  return {
    name: plan.name,
    denomination: plan.denomination,
    timezone: plan.timezone,
    address: plan.address,
    contacts: plan.contacts,
    website: plan.website,
    latitude: typeof lat === 'number' ? lat : null,
    longitude: typeof lng === 'number' ? lng : null,
    languages: plan.languages,
    sortOrder: plan.sortOrder,
    description: entry?.description ?? null,
    socialLinks: entry?.socialLinks ?? [],
    serviceTimes: entry?.serviceTimes ?? [],
  }
}

/** --dry-run / --apply: the church, org-node, language, service-time and pastor rows. */
const runRows = async (apply: boolean) => {
  const rows = loadRows()
  const enrichment = loadEnrichment()
  const plans = buildChurchPlans(rows, {}).filter((plan) => !only || plan.order === only)
  const pastors = groupPastors(rows)
  const work = await resolveWork(plans)

  const pastorForOrder = new Map<string, { pastor: PastorPlan; role: string }>()
  for (const pastor of pastors) {
    for (const assignment of pastor.assignments) {
      pastorForOrder.set(assignment.order, { pastor, role: assignment.role })
    }
  }

  const newWork = work.filter((row) => !row.existing)
  const coverage = (predicate: (entry: EnrichmentEntry | undefined) => boolean) =>
    `${newWork.filter((row) => predicate(enrichment.churches[row.plan.order])).length}/${newWork.length}`

  console.log(
    `\nrows: ${plans.length} | new: ${newWork.length} | update: ${work.length - newWork.length} | pastors: ${pastors.length}`,
  )
  for (const { plan, existing } of work) {
    const entry = enrichment.churches[plan.order]
    const input = inputForPlan(plan, entry)
    console.log(
      `  ${plan.order.padStart(2)} ${existing ? 'UPDATE' : 'CREATE'} ${plan.name} -> ${
        existing?.slug ?? '(slug generated)'
      } | city=${plan.address.city} | website=${plan.website ?? '-'} | coords=${
        input.latitude === null ? 'MISSING' : `${input.latitude},${input.longitude}`
      } | social=${entry?.socialLinks.length ?? 0} | times=${entry?.serviceTimes.length ?? 0} | desc=${
        entry?.description ? 'yes' : 'no'
      }`,
    )
  }

  console.log('\nenrichment coverage (new churches)')
  console.log(`  coordinates   ${coverage((entry) => Boolean(entry?.coordinates))}`)
  console.log(`  social links  ${coverage((entry) => (entry?.socialLinks.length ?? 0) > 0)}`)
  console.log(`  service times ${coverage((entry) => (entry?.serviceTimes.length ?? 0) > 0)}`)
  console.log(`  descriptions  ${coverage((entry) => Boolean(entry?.description))}`)
  if (enrichment.flagged.length) {
    console.log('  flagged (not written):')
    for (const item of enrichment.flagged)
      console.log(`    ${item.order} ${item.field}: ${item.clause}`)
  }

  if (!apply) {
    console.log(
      '\ndry run only — nothing written. Pass --apply to write rows, --images to upload media.',
    )
    return
  }

  if (newWork.length > 0) {
    const missing = [
      ['coordinates', (entry: EnrichmentEntry | undefined) => Boolean(entry?.coordinates)],
      [
        'social links',
        (entry: EnrichmentEntry | undefined) => (entry?.socialLinks.length ?? 0) > 0,
      ],
      [
        'service times',
        (entry: EnrichmentEntry | undefined) => (entry?.serviceTimes.length ?? 0) > 0,
      ],
      ['description', (entry: EnrichmentEntry | undefined) => Boolean(entry?.description)],
    ].filter(
      ([, predicate]) =>
        !newWork.every((row) =>
          (predicate as (entry: EnrichmentEntry | undefined) => boolean)(
            enrichment.churches[row.plan.order],
          ),
        ),
    )
    if (missing.length) {
      throw new Error(
        `refusing --apply: enrichment missing ${missing.map(([name]) => name).join(', ')}`,
      )
    }
  }

  const context = await resolveImportContext()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultPath = resolve(FIXTURES, `result-${stamp}.json`)
  const backupPath = resolve(FIXTURES, `backup-${stamp}.json`)

  const backup = await readBackup({
    slugs: work.map((row) => row.existing?.slug).filter((slug): slug is string => Boolean(slug)),
  })
  writeJson(backupPath, backup)
  console.log(`\nbackup:  ${backupPath} (${backup.churches.length} churches)`)

  const created = {
    churchIds: [] as string[],
    orgNodeIds: [] as string[],
    pastorIds: [] as string[],
  }
  const updated: { churchId: string; fields: Record<string, unknown> }[] = []
  const rowsResult: Record<string, unknown>[] = []

  for (const { plan, existing } of work) {
    const entry = enrichment.churches[plan.order]
    const input = inputForPlan(plan, entry)
    let churchId: string
    let slug: string

    if (existing) {
      const church = await updateChurch({ churchId: existing.id, input, current: existing })
      churchId = church.id
      slug = church.slug
      updated.push({
        churchId,
        fields: {
          denomination: existing.denomination,
          address: existing.address,
          contacts: existing.contacts,
          website: existing.website,
          cover_asset_id: existing.cover_asset_id,
          hero_asset_id: existing.hero_asset_id,
        },
      })
    } else {
      const church = await createChurch({ input, context })
      churchId = church.id
      slug = church.slug
      created.churchIds.push(churchId)
      created.orgNodeIds.push(church.orgNodeId)
    }

    const assignment = pastorForOrder.get(plan.order)
    if (!assignment) throw new Error(`no pastor assignment for row ${plan.order}`)
    const pastorResult = await linkPastor({
      churchId,
      pastor: assignment.pastor,
      role: assignment.role,
    })
    if (pastorResult.created) created.pastorIds.push(pastorResult.pastorId)

    rowsResult.push({
      order: plan.order,
      slug,
      churchId,
      pastorId: pastorResult.pastorId,
      action: existing ? 'updated' : 'created',
      sidecar: plan.sidecar,
      imageSource: plan.churchImage,
      pastorImageSource: assignment.pastor.image,
      description: entry?.description ?? null,
    })
    console.log(`  done ${plan.order.padStart(2)} ${slug}`)
  }

  writeJson(resultPath, {
    phase: 'rows',
    finishedAt: new Date().toISOString(),
    backupPath,
    created,
    updated,
    rowsResult,
  })
  console.log(`\nresult:  ${resultPath}`)
}

/** --images: download each CSV photo, upload it, create the asset row and attach it. */
const runImages = async () => {
  const rows = loadRows()
  const enrichment = loadEnrichment()
  const plans = buildChurchPlans(rows, {}).filter((plan) => !only || plan.order === only)
  const work = await resolveWork(plans)
  if (work.length === 0) throw new Error('nothing matched — check --only')

  const overrides = imageOverrides()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultPath = resolve(FIXTURES, `result-images-${stamp}.json`)
  const assets: Record<string, unknown>[] = []
  const taggedPastors = new Set<string>()
  const failures: { order: string; kind: string; error: string }[] = []

  for (const { plan, existing } of work) {
    if (!existing)
      throw new Error(`church for row ${plan.order} does not exist yet — run --apply first`)
    const churchId = existing.id
    const entry = enrichment.churches[plan.order]

    const upload = async (kind: 'church' | 'pastor', url: string) => {
      const previous =
        kind === 'church'
          ? { cover_asset_id: existing.cover_asset_id, hero_asset_id: existing.hero_asset_id }
          : null
      const transferred = await transferImage({ churchId, url })
      const asset = await createReadyImageAsset({
        churchId,
        key: transferred.key,
        mime: transferred.mime,
        byteSize: transferred.byteSize,
        checksum: transferred.checksum,
      })
      if (kind === 'church') {
        await attachChurchImage({ churchId, assetId: asset.id })
      }
      assets.push({
        order: plan.order,
        slug: existing.slug,
        churchId,
        kind,
        assetId: asset.id,
        key: transferred.key,
        publicUrl: transferred.publicUrl,
        byteSize: transferred.byteSize,
        checksum: transferred.checksum,
        previous,
        source: url,
      })
      return asset
    }

    try {
      if (!kindFilter || kindFilter === 'church') {
        const churchUrl = webFriendlyUrl(overrides[plan.order]?.church ?? plan.churchImage.url)
        await upload('church', churchUrl)
      }
    } catch (error) {
      failures.push({ order: plan.order, kind: 'church', error: (error as Error).message })
    }

    const pastorPlan = groupPastors(rows).find((pastor) =>
      pastor.assignments.some((assignment) => assignment.order === plan.order),
    )
    if (
      (!kindFilter || kindFilter === 'pastor') &&
      pastorPlan &&
      !taggedPastors.has(pastorPlan.email)
    ) {
      taggedPastors.add(pastorPlan.email)
      try {
        const pastorUrl = webFriendlyUrl(overrides[plan.order]?.pastor ?? pastorPlan.image.url)
        const transferred = await transferImage({ churchId, url: pastorUrl })
        const asset = await createReadyImageAsset({
          churchId,
          key: transferred.key,
          mime: transferred.mime,
          byteSize: transferred.byteSize,
          checksum: transferred.checksum,
        })
        const pastorId = (
          await linkPastor({
            churchId,
            pastor: pastorPlan,
            role:
              pastorPlan.assignments.find((assignment) => assignment.order === plan.order)?.role ??
              'Parish pastor',
          })
        ).pastorId
        await attachPastorImage({ pastorId, assetId: asset.id })
        assets.push({
          order: plan.order,
          slug: existing.slug,
          churchId,
          kind: 'pastor',
          assetId: asset.id,
          key: transferred.key,
          publicUrl: transferred.publicUrl,
          byteSize: transferred.byteSize,
          checksum: transferred.checksum,
          previous: null,
          source: pastorUrl,
        })
      } catch (error) {
        failures.push({ order: plan.order, kind: 'pastor', error: (error as Error).message })
      }
    }
    console.log(
      `  done ${plan.order.padStart(2)} ${existing.slug} (social=${entry?.socialLinks.length ?? 0})`,
    )
  }

  writeJson(resultPath, {
    phase: 'images',
    finishedAt: new Date().toISOString(),
    assets,
    failures,
  })
  console.log(`\nassets: ${assets.length} | failures: ${failures.length}`)
  for (const failure of failures)
    console.log(`  FAILED ${failure.order} ${failure.kind}: ${failure.error}`)
  console.log(`result:  ${resultPath}`)
  if (failures.length) process.exitCode = 1
}

/** --rollback=file[:file]: undo a rows run and/or an images run. */
const rollback = async (files: string[]) => {
  for (const file of files) {
    const snapshot = readJson<{
      phase: 'rows' | 'images'
      created?: { churchIds: string[]; orgNodeIds: string[]; pastorIds: string[] }
      updated?: { churchId: string; fields: Record<string, unknown> }[]
      assets?: {
        assetId: string
        key: string
        churchId: string
        kind: 'church' | 'pastor'
        previous: Record<string, string | null> | null
      }[]
    }>(file)

    if (snapshot.phase === 'images') {
      for (const asset of snapshot.assets ?? []) {
        await S3_DELETE_OBJECT({ key: asset.key })
        await db.mediaAsset.deleteMany({ where: { id: asset.assetId } })
        if (asset.kind === 'church' && asset.previous) {
          await db.church.update({
            where: { id: asset.churchId },
            data: {
              cover_asset_id: (asset.previous.cover_asset_id as string | null) ?? null,
              hero_asset_id: (asset.previous.hero_asset_id as string | null) ?? null,
            },
          })
        }
        if (asset.kind === 'pastor') {
          await db.pastor.updateMany({
            where: { image_asset_id: asset.assetId },
            data: { image_asset_id: null },
          })
        }
      }
      console.log(`rollback images: ${snapshot.assets?.length ?? 0} assets removed`)
      continue
    }

    const created = snapshot.created ?? { churchIds: [], orgNodeIds: [], pastorIds: [] }
    // Dependents first: church_pastors / service_times / church_languages / media have no cascade.
    await db.churchPastor.deleteMany({ where: { church_id: { in: created.churchIds } } })
    await db.serviceTime.deleteMany({ where: { church_id: { in: created.churchIds } } })
    await db.churchLanguage.deleteMany({ where: { church_id: { in: created.churchIds } } })
    await db.mediaAsset.deleteMany({ where: { church_id: { in: created.churchIds } } })
    const removedChurches = await db.church.deleteMany({ where: { id: { in: created.churchIds } } })
    const removedPastors = await db.pastor.deleteMany({ where: { id: { in: created.pastorIds } } })
    const removedNodes = await db.orgNode.deleteMany({ where: { id: { in: created.orgNodeIds } } })
    let restored = 0
    for (const row of snapshot.updated ?? []) {
      await db.church.update({ where: { id: row.churchId }, data: row.fields })
      restored += 1
    }
    console.log(
      `rollback rows: ${removedChurches.count} churches, ${removedPastors.count} pastors, ${removedNodes.count} org nodes removed | ${restored} restored`,
    )
  }
}

const main = async () => {
  if (rollbackFiles.length > 0) {
    assertTarget()
    await rollback(rollbackFiles)
    return
  }
  if (mode === '--collect-sources') {
    await collectSources()
    return
  }
  if (mode === '--check-descriptions') {
    checkDescriptions()
    return
  }
  if (mode === '--enrich') {
    await enrich()
    return
  }

  assertTarget()
  if (mode === '--images') {
    await runImages()
    return
  }
  await runRows(mode === '--apply')
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (error) => {
    console.log(error)
    await db.$disconnect()
    process.exit(1)
  })
