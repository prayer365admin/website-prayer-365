/*
 * Database writes for the church directory import. Every function is one unit of
 * work over the app's own Prisma client; the CLI decides the order and keeps the
 * backup/result JSON that makes a run reversible.
 */
import type { Prisma } from '@prisma/client'
import { db } from '../../utils/db-connection'
import { buildChurchSlug } from '../../utils/build-church-slug'
import { normaliseName, type PastorPlan } from './rules'

export const DIOCESE_NAME = 'Estonia Diocese'
export const APPROVER_EMAIL = 'admin@catatia.com'

export interface ImportContext {
  dioceseId: string
  approverId: string
}

export interface ServiceTimeInput {
  weekday: number
  time: string
  label: string
  language: string
}

export const resolveImportContext = async (): Promise<ImportContext> => {
  const diocese = await db.orgNode.findFirst({
    where: { kind: 'DIOCESE', name: DIOCESE_NAME },
    select: { id: true },
  })
  const approver = await db.user.findFirst({
    where: { email: APPROVER_EMAIL },
    select: { id: true },
  })
  if (!diocese) throw new Error(`org node "${DIOCESE_NAME}" (DIOCESE) not found in this DB`)
  if (!approver) throw new Error(`approver user ${APPROVER_EMAIL} not found in this DB`)
  return { dioceseId: diocese.id, approverId: approver.id }
}

export interface ChurchRowForMatch {
  id: string
  slug: string
  name: string
  contacts: unknown
  website: string | null
  denomination: string | null
  address: unknown
  approved_by: string | null
  approved_at: Date | null
  cover_asset_id: string | null
  hero_asset_id: string | null
}

/** Existing church for a CSV row: by alias slug first, then by normalised name. */
export const findExistingChurch = async ({
  normalisedName,
  aliasSlug,
}: {
  normalisedName: string
  aliasSlug: string | null
}): Promise<ChurchRowForMatch | null> => {
  const select = {
    id: true,
    slug: true,
    name: true,
    contacts: true,
    website: true,
    denomination: true,
    address: true,
    approved_by: true,
    approved_at: true,
    cover_asset_id: true,
    hero_asset_id: true,
  } as const

  if (aliasSlug) return db.church.findFirst({ where: { slug: aliasSlug }, select })

  const rows = await db.church.findMany({ select })
  // Same normalisation on BOTH sides: "St." vs "St", curly vs straight apostrophes.
  return rows.find((row) => normaliseName(row.name) === normalisedName) ?? null
}

export interface ChurchWriteInput {
  name: string
  denomination: string
  timezone: string
  address: { line1: string; city: string }
  contacts: { email?: string }
  website: string | null
  latitude: number | null
  longitude: number | null
  languages: string[]
  sortOrder: number
  /** Enrichment (plan 037 D13-D16). Only ever written on CREATE. */
  description: string | null
  socialLinks: { url: string; label: string }[]
  serviceTimes: ServiceTimeInput[]
}

export const createChurch = async ({
  input,
  context,
}: {
  input: ChurchWriteInput
  context: ImportContext
}) =>
  db.$transaction(async (tx) => {
    const node = await tx.orgNode.create({
      data: {
        kind: 'CHURCH',
        name: input.name,
        parent_id: context.dioceseId,
        sort_order: input.sortOrder,
      },
    })
    const slug = await buildChurchSlug(input.name, tx)
    const church = await tx.church.create({
      data: {
        org_node_id: node.id,
        name: input.name,
        slug,
        status: 'APPROVED',
        approved_by: context.approverId,
        approved_at: new Date(),
        timezone: input.timezone,
        denomination: input.denomination,
        address: input.address,
        contacts: input.contacts,
        social_links: input.socialLinks,
        description: input.description,
        website: input.website,
        ...(input.latitude !== null && input.longitude !== null
          ? { latitude: input.latitude, longitude: input.longitude }
          : {}),
      },
      select: { id: true, slug: true },
    })
    for (const language_code of input.languages) {
      await tx.churchLanguage.create({ data: { church_id: church.id, language_code } })
    }
    // ServiceTime.local_time is a @db.Time column: a Date on a fixed day carries the clock time.
    for (const serviceTime of input.serviceTimes) {
      const [hours, minutes] = serviceTime.time.split(':').map(Number)
      await tx.serviceTime.create({
        data: {
          church_id: church.id,
          weekday: serviceTime.weekday,
          local_time: new Date(Date.UTC(1970, 0, 1, hours, minutes)),
          label: serviceTime.label,
          language_code: serviceTime.language,
        },
      })
    }
    return { ...church, orgNodeId: node.id }
  })

/**
 * Update path for the 6 hand-made churches: CSV facts only. Keeps the curated
 * description, social links, service times, gallery, and never clears a value the
 * CSV does not supply.
 */
export const updateChurch = async ({
  churchId,
  input,
  current,
}: {
  churchId: string
  input: ChurchWriteInput
  current: ChurchRowForMatch
}) => {
  const contacts = { ...((current.contacts as Record<string, unknown>) ?? {}) }
  if (input.contacts.email) contacts.email = input.contacts.email
  return db.church.update({
    where: { id: churchId },
    data: {
      denomination: input.denomination,
      timezone: input.timezone,
      address: input.address,
      contacts: contacts as Prisma.InputJsonValue,
      status: 'APPROVED',
      ...(input.website ? { website: input.website } : {}),
      ...(input.latitude !== null && input.longitude !== null
        ? { latitude: input.latitude, longitude: input.longitude }
        : {}),
      approved_by: current.approved_by,
      approved_at: current.approved_at,
    },
    select: { id: true, slug: true },
  })
}

/**
 * One pastors row per name. When PROD already has several rows with that name
 * (Toomas Nigola), the one WITH a user_id wins — that is the account a pastor logs
 * in with.
 */
export const linkPastor = async ({
  churchId,
  pastor,
  role,
}: {
  churchId: string
  pastor: PastorPlan
  role: string
}) => {
  const candidates = await db.pastor.findMany({
    where: { name: pastor.name, deleted_at: null },
    select: { id: true, user_id: true },
  })
  const preferred = candidates.find((row) => row.user_id) ?? candidates[0]
  const pastorId = preferred?.id ?? (await db.pastor.create({ data: { name: pastor.name } })).id
  await db.churchPastor.upsert({
    where: { church_id_pastor_id: { church_id: churchId, pastor_id: pastorId } },
    create: { church_id: churchId, pastor_id: pastorId, pastoral_role: role },
    update: { pastoral_role: role },
  })
  return { pastorId, created: !preferred }
}

export const createReadyImageAsset = ({
  churchId,
  key,
  mime,
  byteSize,
  checksum,
}: {
  churchId: string
  key: string
  mime: string
  byteSize: number
  checksum: string
}) =>
  db.mediaAsset.create({
    data: {
      church_id: churchId,
      object_key: key,
      purpose: 'IMAGE',
      mime_type: mime,
      byte_size: BigInt(byteSize),
      checksum,
      status: 'READY',
    },
    select: { id: true, object_key: true },
  })

export const attachChurchImage = ({ churchId, assetId }: { churchId: string; assetId: string }) =>
  db.church.update({
    where: { id: churchId },
    data: { cover_asset_id: assetId, hero_asset_id: assetId },
    select: { id: true },
  })

export const attachPastorImage = ({ pastorId, assetId }: { pastorId: string; assetId: string }) =>
  db.pastor.update({
    where: { id: pastorId },
    data: { image_asset_id: assetId },
    select: { id: true },
  })

/** Pre-image of every church the run can touch. Written before the first mutation. */
export const readBackup = async ({ slugs }: { slugs: string[] }) => {
  const churches = slugs.length
    ? await db.church.findMany({
        where: { slug: { in: slugs } },
        include: {
          org_node: true,
          churchLanguages: true,
          pastors: true,
          cover_asset: { select: { id: true, object_key: true } },
          hero_asset: { select: { id: true, object_key: true } },
        },
      })
    : []
  const pastorIds = churches.flatMap((church) => church.pastors.map((link) => link.pastor_id))
  const pastors = pastorIds.length
    ? await db.pastor.findMany({ where: { id: { in: pastorIds } } })
    : []
  return { takenAt: new Date().toISOString(), churches, pastors }
}
