/* eslint-disable no-console -- seed progress is intentionally reported on stdout */

import { createHash } from 'node:crypto'

import { db } from '../../src/utils/db-connection'
import customSlugify from '../../src/utils/slugify'
import viimsiDraftPrayers from './data/viimsi-draft-prayers.json'
import viimsiWrittenPrayers from './data/viimsi-written-prayers.json'
import { PRAYER_ROLES } from './prayer-roles'
import { getAdminUser } from './test-context'
import { TEST_PASSWORD } from './user'

/** Public sources used for this real-data seed, reviewed on 2026-10-26. */
export const VIIMSI_DATA_SOURCES = {
  church: 'https://viimsijaakobikirik.ee/kirik/',
  home: 'https://viimsijaakobikirik.ee/',
  clergy: 'https://viimsijaakobikirik.ee/kontakt/vaimulikud/',
  sermons: 'https://viimsijaakobikirik.ee/jutlused/',
  rohuneemeChapel: 'https://viimsijaakobikirik.ee/rohuneeme-kabel/',
  coordinates:
    'https://www.avaandmed.ee/Eesti_Evangeelse_Luterliku_Kiriku_Viimsi_P%C3%BCha_Jaakobi_Kogudus_%2880209820%29',
  registry:
    'https://ariregister.rik.ee/est/company/80209820/Eesti-Evangeelse-Luterliku-Kiriku-Viimsi-P%C3%BCha-Jaakobi-Kogudus',
  samplePrayers: 'docs/admin/SEED-DATA/Prayer365 näidispalved.docx',
} as const

// Source: VIIMSI_DATA_SOURCES.church (official displayed church name).
export const VIIMSI_CHURCH_NAME = 'Viimsi Püha Jaakobi kirik'

// Source: the church is an EELK congregation in the Ida-Harju deanery.
// The English node suffixes follow this project's existing organization naming convention.
const VIIMSI_DEANERY_NAME = 'Ida-Harju Deanery'
const VIIMSI_CHURCH_NODE_NAME = `${VIIMSI_CHURCH_NAME} Node`
// Source: VIIMSI_DATA_SOURCES.clergy.
const VIIMSI_PASTOR_NAME = 'Mikk Leedjärv'
const VIIMSI_PASTOR_EMAIL = 'viimsi.pastor@example.com'
export const VIIMSI_REVIEWER_EMAIL = 'viimsi.global.admin@example.com'
export const VIIMSI_CHURCH_ADMIN_EMAIL = 'viimsi.church.admin@example.com'

const viimsiRoleEmail = (roleName: string) =>
  roleName === 'prayer_pastor'
    ? VIIMSI_PASTOR_EMAIL
    : `viimsi.${roleName.replace(/^prayer_/, '').replaceAll('_', '.')}@example.com`

const viimsiRoleName = (roleName: string) =>
  roleName === 'prayer_pastor'
    ? VIIMSI_PASTOR_NAME
    : `Viimsi ${roleName
        .replace(/^prayer_/, '')
        .split('_')
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(' ')}`

// Synthetic test customers: no real congregant data is sourced or stored.
const VIIMSI_CUSTOMERS = [
  { email: 'viimsi.believer@example.com', name: 'Viimsi Demo Believer' },
  { email: 'viimsi.visitor@example.com', name: 'Viimsi Demo Visitor' },
]

const VIIMSI_ANNOUNCEMENTS = [
  {
    title: 'Näitus kirikus',
    body: 'Meie kirikusse on paika saanud uus näitus. Avamine toimub 18. oktoobril peale teenistust.',
    // Source: VIIMSI_DATA_SOURCES.home. The source displayed "2 weeks ago"
    // when reviewed on 2026-10-26, so 2026-10-12 is an inferred publication date.
    published_at: new Date('2026-10-12T09:00:00.000Z'),
  },
]

const VIIMSI_PROFILE = {
  // APPROVED is a seed workflow decision: all cited church details are publicly verifiable.
  status: 'APPROVED' as const,
  // Source: the church's Estonian location; Europe/Tallinn is the applicable IANA zone.
  timezone: 'Europe/Tallinn',
  // Source: VIIMSI_DATA_SOURCES.home links the congregation to EELK.
  denomination: 'Lutheran (EELK)',
  // Editorial summary derived from the maritime architecture described at
  // VIIMSI_DATA_SOURCES.church; this is not an official style classification.
  church_style: 'Contemporary maritime sanctuary',
  // Source: VIIMSI_DATA_SOURCES.church.
  description:
    'Viimsi Püha Jaakobi kirik is a modern Lutheran church consecrated on 25 July 2007. The first new Lutheran church built in Estonia after the Second World War, it is dedicated to all who have lost their lives at sea. Its architecture by Martin Aunin and Erkki Ristoja recalls the wooden boathouses of the Viimsi coast.',
  // Sources: VIIMSI_DATA_SOURCES.home and VIIMSI_DATA_SOURCES.registry.
  address: {
    line1: 'Nurme tee 2',
    line2: 'Haabneeme, Viimsi vald',
    city: 'Haabneeme',
    postalCode: '74001',
    countryCode: 'EE',
  },
  // Source: VIIMSI_DATA_SOURCES.coordinates.
  latitude: 59.520729,
  longitude: 24.80819,
  // Sources: VIIMSI_DATA_SOURCES.home and VIIMSI_DATA_SOURCES.registry.
  contacts: {
    email: 'viimsi@eelk.ee',
    phone: '+372 607 5070',
  },
  // Source: VIIMSI_DATA_SOURCES.home.
  website: 'https://viimsijaakobikirik.ee/',
  // Source: Facebook and YouTube destinations linked by VIIMSI_DATA_SOURCES.home.
  social_links: [
    { label: 'Facebook', url: 'https://facebook.com/122938177717046' },
    {
      label: 'YouTube',
      url: 'https://www.youtube.com/channel/UCwuACDzgj1tf35b4mcg9dOA/',
    },
  ],
  // Source: the five one-time donation choices on VIIMSI_DATA_SOURCES.home.
  // monthlyEnabled=false is inferred because the page offers no recurring option.
  donation_options: {
    currency: 'EUR',
    presetsMinor: [500, 1000, 2000, 5000, 10000],
    monthlyEnabled: false,
  },
}

const VIIMSI_SERVICE_TIMES = [
  {
    // Source: the recurring calendar entries on VIIMSI_DATA_SOURCES.home.
    weekday: 2,
    local_time: new Date('1970-01-01T18:00:00Z'),
    label: 'Katoliku missa',
    language_code: 'et',
  },
  {
    // Source: the recurring calendar entries on VIIMSI_DATA_SOURCES.home.
    weekday: 7,
    local_time: new Date('1970-01-01T11:00:00Z'),
    label: 'Teenistus armulauaga',
    language_code: 'et',
  },
  {
    // Source: VIIMSI_DATA_SOURCES.rohuneemeChapel.
    weekday: 7,
    local_time: new Date('1970-01-01T13:00:00Z'),
    label: 'Armulauaga jumalateenistus Rohuneeme kabelis (kuu esimesel pühapäeval)',
    language_code: 'et',
  },
]

interface ViimsiSermon {
  sourceSlug: string
  title: string
  publishedAt: string
  sourcePageUrl: string
  body: string
}

interface ViimsiDraftPrayer {
  sourceLabel: string
  title: string
  introduction: string
  body: string
}

/** Full written sermons from the LUGEMISEKS list, sourced through WordPress category 11. */
export const VIIMSI_SERMONS: ViimsiSermon[] = viimsiWrittenPrayers

/** Seven unpublished sample prayers from the client-provided DOCX. */
export const VIIMSI_DRAFT_PRAYERS: ViimsiDraftPrayer[] = viimsiDraftPrayers

const seedSlug = (text: string) => customSlugify({ text, isExists: false })
const sermonIntroduction = (publishedAt: string) =>
  `Viimsi Püha Jaakobi koguduse jutlus • ${new Intl.DateTimeFormat('et-EE', {
    dateStyle: 'long',
    timeZone: 'Europe/Tallinn',
  }).format(new Date(publishedAt))}`
const sermonHash = (title: string, introduction: string, body: string) =>
  createHash('sha256').update(`${title}\n${introduction}\n${body}`).digest('hex')

/**
 * Seeds the real church profile and its directly related records.
 * Voice profiles, consent records, active voices and prayer audio are intentionally untouched.
 */
export const seedViimsiChurch = async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('seedViimsiChurch: admin missing')

  const diocese = await db.orgNode.findFirst({
    where: { kind: 'DIOCESE', name: 'Estonia Diocese' },
  })
  if (!diocese) throw new Error('seedViimsiChurch: Estonia Diocese missing')

  let deanery = await db.orgNode.findFirst({
    where: { kind: 'DEANERY', name: VIIMSI_DEANERY_NAME },
  })
  if (!deanery) {
    deanery = await db.orgNode.create({
      data: { kind: 'DEANERY', name: VIIMSI_DEANERY_NAME, parent_id: diocese.id },
    })
  }

  let node = await db.orgNode.findFirst({ where: { name: VIIMSI_CHURCH_NODE_NAME } })
  if (!node) {
    node = await db.orgNode.create({
      data: { kind: 'CHURCH', name: VIIMSI_CHURCH_NODE_NAME, parent_id: deanery.id },
    })
  }

  let church = await db.church.findFirst({ where: { name: VIIMSI_CHURCH_NAME } })
  if (church) {
    church = await db.church.update({
      where: { id: church.id },
      data: VIIMSI_PROFILE,
    })
  } else {
    church = await db.church.create({
      data: {
        org_node_id: node.id,
        name: VIIMSI_CHURCH_NAME,
        slug: seedSlug(VIIMSI_CHURCH_NAME),
        approved_by: admin.id,
        approved_at: new Date(),
        ...VIIMSI_PROFILE,
      },
    })
  }

  await db.churchLanguage.upsert({
    where: { church_id_language_code: { church_id: church.id, language_code: 'et' } },
    update: {},
    create: { church_id: church.id, language_code: 'et' },
  })

  for (const serviceTime of VIIMSI_SERVICE_TIMES) {
    const existing = await db.serviceTime.findFirst({
      where: {
        church_id: church.id,
        weekday: serviceTime.weekday,
        local_time: serviceTime.local_time,
      },
    })
    if (existing) {
      await db.serviceTime.update({
        where: { id: existing.id },
        data: { label: serviceTime.label, language_code: serviceTime.language_code },
      })
    } else {
      await db.serviceTime.create({ data: { church_id: church.id, ...serviceTime } })
    }
  }

  let pastor = await db.pastor.findFirst({ where: { name: VIIMSI_PASTOR_NAME } })
  if (pastor) {
    pastor = await db.pastor.update({
      where: { id: pastor.id },
      // Source: VIIMSI_DATA_SOURCES.clergy.
      data: { introduction: 'Viimsi Püha Jaakobi koguduse õpetaja.' },
    })
  } else {
    pastor = await db.pastor.create({
      data: {
        name: VIIMSI_PASTOR_NAME,
        // Source: VIIMSI_DATA_SOURCES.clergy.
        introduction: 'Viimsi Püha Jaakobi koguduse õpetaja.',
      },
    })
  }

  await db.churchPastor.upsert({
    where: { church_id_pastor_id: { church_id: church.id, pastor_id: pastor.id } },
    // Source: VIIMSI_DATA_SOURCES.clergy ("koguduseõpetaja").
    update: { pastoral_role: 'Koguduseõpetaja' },
    create: {
      church_id: church.id,
      pastor_id: pastor.id,
      pastoral_role: 'Koguduseõpetaja',
    },
  })

  console.log(`[seed] real church ${VIIMSI_CHURCH_NAME}: profile, services and pastor`)
}

/**
 * Ensures every seeded role account can reach Viimsi through the correct scope.
 * Global, country and diocese assignments already inherit Viimsi through the
 * hierarchy; this also adds the missing Ida-Harju and church-level assignments.
 */
export const seedViimsiRoleAssignments = async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('seedViimsiRoleAssignments: admin missing')

  const nodes = {
    GLOBAL: await db.orgNode.findFirst({ where: { kind: 'GLOBAL' } }),
    COUNTRY: await db.orgNode.findFirst({ where: { kind: 'COUNTRY', name: 'Estonia Country' } }),
    DIOCESE: await db.orgNode.findFirst({ where: { kind: 'DIOCESE', name: 'Estonia Diocese' } }),
    DEANERY: await db.orgNode.findFirst({ where: { kind: 'DEANERY', name: VIIMSI_DEANERY_NAME } }),
    CHURCH: await db.orgNode.findFirst({
      where: { kind: 'CHURCH', name: VIIMSI_CHURCH_NODE_NAME },
    }),
  }

  if (Object.values(nodes).some((node) => !node)) {
    throw new Error('seedViimsiRoleAssignments: organization hierarchy incomplete')
  }

  for (const roleDefinition of PRAYER_ROLES) {
    const scopeKind =
      roleDefinition.name === 'prayer_global_admin'
        ? 'GLOBAL'
        : roleDefinition.name === 'prayer_country_admin'
          ? 'COUNTRY'
          : roleDefinition.name === 'prayer_diocese_admin'
            ? 'DIOCESE'
            : roleDefinition.name === 'prayer_deanery_admin'
              ? 'DEANERY'
              : 'CHURCH'
    const node = nodes[scopeKind]
    const role = await db.role.findUnique({ where: { name: roleDefinition.name } })
    if (!node || !role) {
      throw new Error(`seedViimsiRoleAssignments: dependency missing for ${roleDefinition.name}`)
    }

    const user = await db.user.upsert({
      where: { email: viimsiRoleEmail(roleDefinition.name) },
      update: {
        name: viimsiRoleName(roleDefinition.name),
        password: TEST_PASSWORD,
        email_verified_at: new Date(),
        locale: 'et',
        role_id: role.id,
      },
      create: {
        email: viimsiRoleEmail(roleDefinition.name),
        name: viimsiRoleName(roleDefinition.name),
        password: TEST_PASSWORD,
        email_verified_at: new Date(),
        locale_language: { connect: { code: 'et' } },
        role: { connect: { id: role.id } },
      },
    })

    const existing = await db.roleAssignment.findFirst({
      where: {
        user_id: user.id,
        role_id: role.id,
        org_node_id: node.id,
        revoked_at: null,
      },
    })
    if (!existing) {
      await db.roleAssignment.create({
        data: {
          user_id: user.id,
          role_id: role.id,
          org_node_id: node.id,
          granted_by: admin.id,
        },
      })
    }
  }

  const pastorRole = await db.role.findUnique({ where: { name: 'prayer_pastor' } })
  const churchNode = nodes.CHURCH
  const pastor = await db.pastor.findFirst({ where: { name: VIIMSI_PASTOR_NAME } })
  if (!pastorRole || !churchNode || !pastor) {
    throw new Error('seedViimsiRoleAssignments: dedicated pastor dependencies missing')
  }

  const pastorUser = await db.user.findUnique({ where: { email: VIIMSI_PASTOR_EMAIL } })
  if (!pastorUser) throw new Error('seedViimsiRoleAssignments: dedicated pastor user missing')

  await db.pastor.update({
    where: { id: pastor.id },
    data: { user_id: pastorUser.id },
  })

  const pastorAssignment = await db.roleAssignment.findFirst({
    where: {
      user_id: pastorUser.id,
      role_id: pastorRole.id,
      org_node_id: churchNode.id,
      revoked_at: null,
    },
  })
  if (!pastorAssignment) {
    await db.roleAssignment.create({
      data: {
        user_id: pastorUser.id,
        role_id: pastorRole.id,
        org_node_id: churchNode.id,
        granted_by: admin.id,
      },
    })
  }

  // A previous version of this seed reused the shared demo pastor account.
  // Revoke only that obsolete Viimsi assignment when upgrading an existing DB.
  const sharedPastorUser = await db.user.findUnique({
    where: { email: 'prayer_pastor@example.com' },
  })
  if (sharedPastorUser) {
    await db.roleAssignment.updateMany({
      where: {
        user_id: sharedPastorUser.id,
        role_id: pastorRole.id,
        org_node_id: churchNode.id,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    })
  }

  console.log(`[seed] real church ${VIIMSI_CHURCH_NAME}: ${PRAYER_ROLES.length} roles scoped`)
}

/** Adds synthetic, role-less mobile customers without using real congregant PII. */
export const seedViimsiCustomers = async () => {
  const church = await db.church.findFirst({ where: { name: VIIMSI_CHURCH_NAME } })
  if (!church) throw new Error('seedViimsiCustomers: church missing')

  for (const customer of VIIMSI_CUSTOMERS) {
    const onboardingCompletedAt = new Date()
    const user = await db.user.upsert({
      where: { email: customer.email },
      update: {
        name: customer.name,
        password: TEST_PASSWORD,
        email_verified_at: onboardingCompletedAt,
        church_setup_completed_at: onboardingCompletedAt,
        locale_setup_completed_at: onboardingCompletedAt,
        locale: 'et',
        role_id: null,
      },
      create: {
        email: customer.email,
        name: customer.name,
        password: TEST_PASSWORD,
        email_verified_at: onboardingCompletedAt,
        church_setup_completed_at: onboardingCompletedAt,
        locale_setup_completed_at: onboardingCompletedAt,
        locale_language: { connect: { code: 'et' } },
        // No role: customers have subject-only mobile access.
      },
    })

    await db.userChurch.updateMany({
      where: { user_id: user.id, is_main: true, church_id: { not: church.id } },
      data: { is_main: false },
    })
    await db.userChurch.upsert({
      where: { user_id_church_id: { user_id: user.id, church_id: church.id } },
      update: { is_main: true, is_followed: true },
      create: {
        user_id: user.id,
        church_id: church.id,
        is_main: true,
        is_followed: true,
      },
    })

    await db.notificationPreference.upsert({
      where: { user_id_type: { user_id: user.id, type: 'daily_prayer' } },
      update: { enabled: true },
      create: { user_id: user.id, type: 'daily_prayer', enabled: true },
    })
    await db.notificationPreference.upsert({
      where: { user_id_type: { user_id: user.id, type: 'donation_reminder' } },
      update: {},
      create: { user_id: user.id, type: 'donation_reminder', enabled: false },
    })
  }

  console.log(`[seed] real church ${VIIMSI_CHURCH_NAME}: ${VIIMSI_CUSTOMERS.length} customers`)
}

/** Seeds published notices shown on the official Viimsi church homepage. */
export const seedViimsiAnnouncements = async () => {
  const church = await db.church.findFirst({ where: { name: VIIMSI_CHURCH_NAME } })
  if (!church) throw new Error('seedViimsiAnnouncements: church missing')

  for (const announcement of VIIMSI_ANNOUNCEMENTS) {
    const existing = await db.announcement.findFirst({
      where: { church_id: church.id, title: announcement.title },
    })
    if (existing) {
      await db.announcement.update({
        where: { id: existing.id },
        data: { body: announcement.body, published_at: announcement.published_at },
      })
    } else {
      await db.announcement.create({
        data: { church_id: church.id, ...announcement },
      })
    }
  }

  console.log(
    `[seed] real church ${VIIMSI_CHURCH_NAME}: ${VIIMSI_ANNOUNCEMENTS.length} announcement`,
  )
}

/**
 * Seeds source sermons as published prayers. No PrayerAudio rows are created;
 * their audio will be generated later with Mikk Leedjärv's real voice profile.
 */
export const seedViimsiPrayers = async () => {
  const author = await db.user.findUnique({ where: { email: VIIMSI_CHURCH_ADMIN_EMAIL } })
  const reviewer = await db.user.findUnique({ where: { email: VIIMSI_REVIEWER_EMAIL } })
  const church = await db.church.findFirst({ where: { name: VIIMSI_CHURCH_NAME } })
  const pastor = await db.pastor.findFirst({ where: { name: VIIMSI_PASTOR_NAME } })
  if (!author || !reviewer || !church || !pastor) {
    throw new Error('seedViimsiPrayers: church, pastor or dedicated Viimsi staff missing')
  }

  // Remove obsolete MP3-link placeholders owned by the first version of this
  // seed. A matching LUGEMISEKS slug is preserved and rewritten below, even
  // when its title also appeared in the old KUULAMISEKS list.
  const writtenSlugs = new Set(
    VIIMSI_SERMONS.map((sermon) => seedSlug(`${church.slug}-${sermon.sourceSlug}`)),
  )
  const audioOnlyCandidates = await db.prayer.findMany({
    where: {
      church_id: church.id,
      versions: {
        some: {
          body: { startsWith: '<p>Jutluse originaalsalvestis:' },
        },
      },
    },
    select: { id: true, slug: true, versions: { select: { id: true } } },
  })
  const stalePrayers = audioOnlyCandidates.filter((prayer) => !writtenSlugs.has(prayer.slug))
  for (const stale of stalePrayers) {
    const versionIds = stale.versions.map((version) => version.id)
    await db.$transaction(async (tx) => {
      await tx.prayer.update({
        where: { id: stale.id },
        data: {
          current_version_id: null,
          published_version_id: null,
          scheduled_version_id: null,
          scheduled_at: null,
          published_at: null,
        },
      })
      await tx.prayerVersion.updateMany({
        where: { id: { in: versionIds } },
        data: { selected_audio_id: null },
      })
      await tx.prayerAudio.deleteMany({ where: { prayer_version_id: { in: versionIds } } })
      await tx.prayerVersion.deleteMany({ where: { id: { in: versionIds } } })
      await tx.prayer.delete({ where: { id: stale.id } })
    })
  }

  for (const sermon of VIIMSI_SERMONS) {
    const introduction = sermonIntroduction(sermon.publishedAt)
    const body = sermon.body
    const textHash = sermonHash(sermon.title, introduction, body)
    const publishedAt = new Date(sermon.publishedAt)
    const prayerSlug = seedSlug(`${church.slug}-${sermon.sourceSlug}`)

    let prayer = await db.prayer.findUnique({ where: { slug: prayerSlug } })
    if (!prayer) {
      prayer = await db.prayer.create({
        data: {
          slug: prayerSlug,
          church_id: church.id,
          created_by: author.id,
        },
      })
    }

    let version = await db.prayerVersion.findFirst({
      where: { prayer_id: prayer.id, version_number: 1 },
    })
    if (version) {
      version = await db.prayerVersion.update({
        where: { id: version.id },
        data: {
          pastor_id: pastor.id,
          title: sermon.title,
          introduction,
          body,
          language_code: 'et',
          text_hash: textHash,
          approved_by: reviewer.id,
          approved_at: publishedAt,
        },
      })
    } else {
      version = await db.prayerVersion.create({
        data: {
          prayer_id: prayer.id,
          version_number: 1,
          pastor_id: pastor.id,
          title: sermon.title,
          introduction,
          body,
          language_code: 'et',
          text_hash: textHash,
          approved_by: reviewer.id,
          approved_at: publishedAt,
        },
      })
    }

    await db.prayer.update({
      where: { id: prayer.id },
      data: {
        current_version_id: version.id,
        published_version_id: version.id,
        published_at: publishedAt,
      },
    })
  }

  console.log(
    `[seed] real prayers ${VIIMSI_CHURCH_NAME}: ${VIIMSI_SERMONS.length} full texts without audio`,
  )
}

/**
 * Seeds the client-provided sample prayers as editable drafts. They are never
 * approved, published, scheduled, or connected to PrayerAudio by this seed.
 */
export const seedViimsiDraftPrayers = async () => {
  const author = await db.user.findUnique({ where: { email: VIIMSI_CHURCH_ADMIN_EMAIL } })
  const church = await db.church.findFirst({ where: { name: VIIMSI_CHURCH_NAME } })
  const pastor = await db.pastor.findFirst({ where: { name: VIIMSI_PASTOR_NAME } })
  if (!author || !church || !pastor) {
    throw new Error('seedViimsiDraftPrayers: church, pastor or Viimsi author missing')
  }

  for (const item of VIIMSI_DRAFT_PRAYERS) {
    const slug = seedSlug(`${church.slug}-naidispalve-${item.sourceLabel}`)
    let prayer = await db.prayer.findUnique({ where: { slug } })
    if (!prayer) {
      prayer = await db.prayer.create({
        data: { slug, church_id: church.id, created_by: author.id },
      })
    }

    let version = await db.prayerVersion.findFirst({
      where: { prayer_id: prayer.id, version_number: 1 },
    })
    // Once an administrator reviews a seeded draft, later seed runs must not
    // rewrite or demote that reviewed content.
    if (version?.approved_at || prayer.published_version_id) continue

    const textHash = sermonHash(item.title, item.introduction, item.body)
    if (version) {
      version = await db.prayerVersion.update({
        where: { id: version.id },
        data: {
          pastor_id: pastor.id,
          title: item.title,
          introduction: item.introduction,
          body: item.body,
          language_code: 'et',
          text_hash: textHash,
          approved_by: null,
          approved_at: null,
        },
      })
    } else {
      version = await db.prayerVersion.create({
        data: {
          prayer_id: prayer.id,
          version_number: 1,
          pastor_id: pastor.id,
          title: item.title,
          introduction: item.introduction,
          body: item.body,
          language_code: 'et',
          text_hash: textHash,
        },
      })
    }

    await db.prayer.update({
      where: { id: prayer.id },
      data: {
        current_version_id: version.id,
        published_version_id: null,
        scheduled_version_id: null,
        scheduled_at: null,
        published_at: null,
      },
    })
  }

  console.log(
    `[seed] draft prayers ${VIIMSI_CHURCH_NAME}: ${VIIMSI_DRAFT_PRAYERS.length} unreviewed without audio`,
  )
}
