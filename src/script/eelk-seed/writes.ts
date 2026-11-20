import type { Prisma } from '@prisma/client'
import { buildChurchSlug } from '../../utils/build-church-slug'
import { db } from '../../utils/db-connection'
import { transferImage } from '../church-directory-import/images'
import type { SeedChurch } from './dataset'

export const DIOCESE_NAME = 'Estonia Diocese'
export const APPROVER_EMAIL = 'admin@catatia.com'

export interface ImportContext {
  dioceseId: string
  approverId: string
}

export interface ExistingChurch {
  id: string
  slug: string
  name: string
  status: string
  description: string | null
  cover_asset_id: string | null
  hero_asset_id: string | null
  galleryItems: { id: string; media_asset_id: string }[]
}

export const resolveContext = async (): Promise<ImportContext> => {
  const diocese = await db.orgNode.findFirst({
    where: { kind: 'DIOCESE', name: DIOCESE_NAME },
    select: { id: true },
  })
  const approver = await db.user.findFirst({
    where: { email: APPROVER_EMAIL },
    select: { id: true },
  })
  if (!diocese) throw new Error(`org node "${DIOCESE_NAME}" (DIOCESE) not found`)
  if (!approver) throw new Error(`approver user ${APPROVER_EMAIL} not found`)
  return { dioceseId: diocese.id, approverId: approver.id }
}

/** Reuses an existing DEANERY node by name; creates it under the diocese otherwise. */
export const ensureDeanery = async ({
  name,
  parentId,
}: {
  name: string
  parentId: string
}): Promise<string> => {
  const existing = await db.orgNode.findFirst({
    where: { kind: 'DEANERY', name },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await db.orgNode.create({
    data: { kind: 'DEANERY', name, parent_id: parentId },
    select: { id: true },
  })
  return created.id
}

export const readExistingChurches = (slugs: string[]): Promise<ExistingChurch[]> =>
  db.church.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      description: true,
      cover_asset_id: true,
      hero_asset_id: true,
      galleryItems: { select: { id: true, media_asset_id: true } },
    },
  })

/** Every church, for the name/email fallback that keeps a re-run idempotent after a create. */
export const readAllChurches = async (): Promise<(ExistingChurch & { email: string | null })[]> => {
  const rows = await db.church.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      description: true,
      cover_asset_id: true,
      hero_asset_id: true,
      contacts: true,
      galleryItems: { select: { id: true, media_asset_id: true } },
    },
  })
  return rows.map((row) => {
    const { contacts, ...rest } = row
    const email = (contacts as { email?: string } | null)?.email?.toLowerCase() ?? null
    return { ...rest, email }
  })
}

const addressJson = (church: SeedChurch): Prisma.InputJsonValue => ({
  line1: church.address.line1,
  city: church.address.city,
  ...(church.address.postalCode ? { postalCode: church.address.postalCode } : {}),
  ...(church.address.county ? { county: church.address.county } : {}),
})

const contactsJson = (church: SeedChurch): Prisma.InputJsonValue => ({ ...church.contacts })

const socialJson = (church: SeedChurch): Prisma.InputJsonValue =>
  church.socialLinks as unknown as Prisma.InputJsonValue

const serviceTimeRows = (church: SeedChurch) =>
  church.serviceTimes.map((time) => {
    const [hours, minutes] = time.time.split(':').map(Number)
    return {
      weekday: time.weekday,
      local_time: new Date(Date.UTC(1970, 0, 1, hours, minutes)),
      label: time.label,
      language_code: time.language,
    }
  })

export const createChurch = async ({
  church,
  context,
  deaneryId,
}: {
  church: SeedChurch
  context: ImportContext
  deaneryId: string
}) =>
  db.$transaction(async (tx) => {
    const node = await tx.orgNode.create({
      data: {
        kind: 'CHURCH',
        name: church.name,
        parent_id: deaneryId,
        sort_order: church.order,
      },
      select: { id: true },
    })
    const slug = await buildChurchSlug(church.name, tx)
    const created = await tx.church.create({
      data: {
        org_node_id: node.id,
        name: church.name,
        slug,
        status: 'APPROVED',
        approved_by: context.approverId,
        approved_at: new Date(),
        timezone: church.timezone,
        denomination: church.denomination,
        address: addressJson(church),
        contacts: contactsJson(church),
        social_links: socialJson(church),
        website: church.website,
        ...(church.coordinates
          ? { latitude: church.coordinates.lat, longitude: church.coordinates.lng }
          : {}),
      },
      select: { id: true, slug: true },
    })
    await tx.churchLanguage.create({ data: { church_id: created.id, language_code: 'et' } })
    if (church.serviceTimes.length > 0) {
      await tx.serviceTime.createMany({
        data: serviceTimeRows(church).map((row) => ({ ...row, church_id: created.id })),
      })
    }
    return { churchId: created.id, slug: created.slug, orgNodeId: node.id }
  })

export const updateChurch = async ({
  church,
  existing,
}: {
  church: SeedChurch
  existing: ExistingChurch
}) =>
  db.$transaction(async (tx) => {
    await tx.serviceTime.deleteMany({ where: { church_id: existing.id } })
    if (church.serviceTimes.length > 0) {
      await tx.serviceTime.createMany({
        data: serviceTimeRows(church).map((row) => ({ ...row, church_id: existing.id })),
      })
    }
    const updated = await tx.church.update({
      where: { id: existing.id },
      data: {
        name: church.name,
        timezone: church.timezone,
        denomination: church.denomination,
        address: addressJson(church),
        contacts: contactsJson(church),
        social_links: socialJson(church),
        website: church.website,
        description: null,
        status: 'APPROVED',
        ...(church.coordinates
          ? { latitude: church.coordinates.lat, longitude: church.coordinates.lng }
          : {}),
      },
      select: { id: true, slug: true },
    })
    return { churchId: updated.id, slug: updated.slug }
  })

/** Pre-image of every church the run can touch, written before the first mutation. */
export const readBackup = (churchIds: string[]) =>
  db.church.findMany({
    where: { id: { in: churchIds } },
    include: {
      org_node: true,
      churchLanguages: true,
      serviceTimes: true,
      cover_asset: { select: { id: true, object_key: true } },
      hero_asset: { select: { id: true, object_key: true } },
      galleryItems: {
        select: { id: true, media_asset_id: true, caption: true, order_index: true },
      },
    },
  })

export interface WrittenAsset {
  assetId: string
  key: string
  kind: 'cover' | 'gallery'
  caption: string | null
  license: string
  source: string
}

/**
 * Photos are attached only when the dataset found some: a church with no Commons
 * photo keeps its current cover and gallery (plan 042, D6). Old media_assets rows and
 * S3 objects stay; only the gallery links and the cover pointers move.
 */
export const replacePhotos = async ({
  church,
  churchId,
}: {
  church: SeedChurch
  churchId: string
}): Promise<WrittenAsset[]> => {
  if (church.photos.length === 0) return []
  await db.churchGalleryItem.deleteMany({ where: { church_id: churchId } })
  const written: WrittenAsset[] = []
  for (let index = 0; index < church.photos.length; index += 1) {
    const photo = church.photos[index]
    const transferred = await transferImage({ churchId, url: photo.url })
    const asset = await db.mediaAsset.create({
      data: {
        church_id: churchId,
        object_key: transferred.key,
        purpose: 'IMAGE',
        mime_type: transferred.mime,
        byte_size: BigInt(transferred.byteSize),
        checksum: transferred.checksum,
        status: 'READY',
      },
      select: { id: true },
    })
    if (index === 0) {
      await db.church.update({
        where: { id: churchId },
        data: { cover_asset_id: asset.id, hero_asset_id: asset.id },
      })
    } else {
      await db.churchGalleryItem.create({
        data: {
          church_id: churchId,
          media_asset_id: asset.id,
          caption: photo.caption,
          order_index: index - 1,
        },
      })
    }
    written.push({
      assetId: asset.id,
      key: transferred.key,
      kind: index === 0 ? 'cover' : 'gallery',
      caption: index === 0 ? null : photo.caption,
      license: photo.license,
      source: photo.sourceUrl,
    })
  }
  return written
}
