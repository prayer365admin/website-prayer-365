/* eslint-disable no-console -- a seed module reports what it filled on stdout */

import type { EventCategory, MediaAsset, MediaPurpose } from '@prisma/client'

import { db } from '../../src/utils/db-connection'
import customSlugify from '../../src/utils/slugify'
import {
  PARNU_CHURCH_NAME,
  SECOND_CHURCH_NAME,
  ST_JOHNS_CHURCH_NAME,
  ST_OLAFS_CHURCH_NAME,
} from './church'
import {
  DEMO_AUDIO_KEYS,
  DEMO_IMAGE_KEYS,
  demoMediaByteSize,
  demoMediaContentType,
} from './demo-media'
import { DEMO_CHURCH_NAME, DEMO_PASTOR_NAME, getAdminUser } from './test-context'

/*
 * One table drives every piece of demo content the client sees, so a screen can
 * never be empty by accident: cover + gallery per church, service times, pastoral
 * staff, events, announcements and — the part that was broken — prayers that each
 * carry an APPROVED audio asset.
 *
 * The seeders below are idempotent (matched on stable names/titles/order indexes)
 * and they run AFTER the media + voice-profile seeds, because a prayer audio row
 * needs a READY voice profile and a GENERATED_AUDIO asset that already exists.
 */

interface DemoServiceTime {
  weekday: number
  /** `HH:MM`, stored as a time-of-day. */
  time: string
  label: string
  languageCode: string
}

interface DemoPastor {
  name: string
  role: string
  introduction: string
}

interface DemoEvent {
  offsetDays: number
  hour: number
  minute: number
  category: EventCategory
  title: string
  location: string
  description: string
  registrationUrl?: string
  ctaLabel?: string
  languageCode: string
}

interface DemoPrayer {
  title: string
  introduction: string
  body: string
  audioKey: string
}

interface DemoChurchContent {
  name: string
  coverKey: string
  gallery: { caption: string; imageKey: string }[]
  serviceTimes: DemoServiceTime[]
  pastors: DemoPastor[]
  events: DemoEvent[]
  announcements: { title: string; body: string }[]
  prayers: DemoPrayer[]
}

export const DEMO_CHURCH_CONTENT: DemoChurchContent[] = [
  {
    name: ST_JOHNS_CHURCH_NAME,
    coverKey: DEMO_IMAGE_KEYS.stJohns,
    gallery: [
      { caption: 'Central Nave & Neo-Gothic Vaults', imageKey: DEMO_IMAGE_KEYS.stJohns },
      { caption: '1867 Walcker Pipe Organ', imageKey: DEMO_IMAGE_KEYS.sanctuary },
      { caption: 'Chancel Stained Glass', imageKey: DEMO_IMAGE_KEYS.church },
      { caption: 'Crypt Intercession Corner', imageKey: DEMO_IMAGE_KEYS.lake },
      { caption: 'Tower & Spire over Freedom Square', imageKey: DEMO_IMAGE_KEYS.signUp },
    ],
    serviceTimes: [], // TALLINN/ST_JOHNS seeds own their service times
    pastors: [], // ST_JOHNS_STAFF owns the pastoral office
    events: [],
    announcements: [],
    prayers: [
      {
        title: 'Peace in Uncertain Times',
        introduction:
          'Scripture meditation on Philippians 4:6–7 • Led by Pastor Daniel Carter, Hope Church',
        body: "Scripture meditation on Philippians 4:6–7. Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus. Heavenly Father, calm our restless minds, still our anxious hearts, and envelop our spirits with Your transcendent peace that surpasses all earthly understanding. In Christ's holy name we pray. Amen.",
        audioKey: DEMO_AUDIO_KEYS.peace,
      },
      {
        title: 'The Shepherd’s Protection & Still Waters',
        introduction: "Psalm 23 Contemplation • Led by Rev. Daniel Mäkinen, St. John's Church",
        body: "Psalm 23 meditation. The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul. He leads me in paths of righteousness for His name's sake. Even though I walk through the valley of the shadow of death, I will fear no evil, for You are with me; Your rod and Your staff, they comfort me. Lord, walk beside us in darkness, restore our strength, and lead us into Your eternal light. Amen.",
        audioKey: DEMO_AUDIO_KEYS.shepherd,
      },
      {
        title: 'Morning Liturgy & Eucharist Preparation',
        introduction:
          "Liturgical preparation for Holy Communion • Led by Rev. Daniel Mäkinen, St. John's Church",
        body: 'Lord Jesus Christ, Holy Bread of eternal life and Cup of salvation, prepare our hearts to approach Your holy altar with pure devotion, humble reverence, and joyful thanksgiving. Feed our hungry souls, forgive our transgressions, and knit us together as one holy fellowship in Your divine love. Amen.',
        audioKey: DEMO_AUDIO_KEYS.liturgy,
      },
      {
        title: 'Choral Organ Vespers & Evening Stillness',
        introduction: "Compline night vigil • Led by Chaplain Eva Reinla, St. John's Church",
        body: 'Into Your hands, Lord, we commend our spirits as night descends upon the sanctuary. Keep us as the apple of Your eye; hide us under the shadow of Your wings. Grant rest to the weary, peace to the dying, comfort to the grieving, and holy rest to all Your faithful servants. In the name of the Father, Son, and Holy Spirit. Amen.',
        audioKey: DEMO_AUDIO_KEYS.vespers,
      },
    ],
  },
  {
    name: DEMO_CHURCH_NAME,
    coverKey: DEMO_IMAGE_KEYS.church,
    gallery: [
      { caption: 'Nave from the west door', imageKey: DEMO_IMAGE_KEYS.church },
      { caption: 'Altar & stained glass', imageKey: DEMO_IMAGE_KEYS.stJohns },
      { caption: 'Sanctuary at evening prayer', imageKey: DEMO_IMAGE_KEYS.lake },
    ],
    serviceTimes: [],
    pastors: [
      {
        name: DEMO_PASTOR_NAME,
        role: 'Lead Pastor & Deanery Provost',
        introduction: 'Demo pastor for testing.',
      },
      {
        name: 'Deacon Mari Sepp',
        role: 'Parish Deacon & Outreach',
        introduction:
          'Deacon coordinating the parish food bank, home visits, and the weekly prayer chain.',
      },
    ],
    events: [],
    announcements: [],
    prayers: [
      {
        title: 'Morning Prayer for the City',
        introduction: 'Daily prayer • Led by Pastor Demo Tamm, Tallinn Demo Church',
        body: 'Lord, as the city wakes, we place its streets, homes and workplaces into Your care. Give wisdom to those who lead, patience to those who serve, and comfort to those who woke with fear. Let Your peace settle over every household today. Amen.',
        audioKey: DEMO_AUDIO_KEYS.peace,
      },
      {
        title: 'Evening Thanksgiving & Rest',
        introduction: 'Night prayer • Led by Pastor Demo Tamm, Tallinn Demo Church',
        body: 'Father, thank You for the day You have given us — for its work, its meetings and its mercies. Forgive what we handled poorly and heal what we cannot mend. As night falls, grant rest to our bodies and quietness to our minds, and keep watch over those who sleep alone. Amen.',
        audioKey: DEMO_AUDIO_KEYS.vespers,
      },
    ],
  },
  {
    name: SECOND_CHURCH_NAME,
    coverKey: DEMO_IMAGE_KEYS.sanctuary,
    gallery: [
      { caption: 'Brick-Gothic nave', imageKey: DEMO_IMAGE_KEYS.sanctuary },
      { caption: 'Terracotta figures of the façade', imageKey: DEMO_IMAGE_KEYS.church },
    ],
    serviceTimes: [],
    pastors: [
      {
        name: 'Rev. Andres Kask',
        role: 'Lead Pastor',
        introduction:
          'Lead pastor serving the university parish and the student chaplaincy in Tartu.',
      },
      {
        name: 'Deacon Liis Ojala',
        role: 'Student Ministry',
        introduction:
          'Deacon leading the student small groups, exam-season prayer nights and choir.',
      },
    ],
    events: [
      {
        offsetDays: 4,
        hour: 18,
        minute: 0,
        category: 'BIBLE_STUDY',
        title: "Students' Evening Bible Circle",
        location: 'Parish Hall',
        description:
          'Weekly study circle for students and young adults, followed by tea and prayer requests.',
        languageCode: 'et',
      },
      {
        offsetDays: 9,
        hour: 19,
        minute: 0,
        category: 'COMMUNITY',
        title: 'Autumn Choir Open Rehearsal',
        location: 'Main Nave',
        description:
          'Open rehearsal for anyone who would like to sing with the parish choir this term. No audition needed.',
        registrationUrl: 'https://tartujaani.ee/choir',
        ctaLabel: 'Join the Choir',
        languageCode: 'et',
      },
    ],
    announcements: [
      {
        title: 'Autumn Term Begins',
        body: 'The parish opens the autumn term with a blessing of students and teachers at the Sunday Eucharist. Study circles resume the same week.',
      },
      {
        title: 'Parish Reading Circle',
        body: 'A monthly reading circle on the Psalms meets in the parish hall. Books are provided; begin any month.',
      },
    ],
    prayers: [
      {
        title: 'Prayer for Students & Teachers',
        introduction: 'Opening of the academic term • Led by Rev. Andres Kask, Tartu Demo Church',
        body: 'Lord of wisdom, bless the students of Tartu as they study, and the teachers who open their minds. Give them endurance in long evenings, honesty in their work, and humility in success. Let Your truth be their foundation and Your grace their rest. Amen.',
        audioKey: DEMO_AUDIO_KEYS.liturgy,
      },
      {
        title: 'A Quiet Prayer Before Study',
        introduction: 'Before study or work • Led by Deacon Liis Ojala, Tartu Demo Church',
        body: 'Holy Spirit, clear our thoughts and steady our hearts before we begin. Where we are anxious, speak peace; where we are distracted, bring focus. Bless the work of our hands and let it serve our neighbour. Amen.',
        audioKey: DEMO_AUDIO_KEYS.peace,
      },
    ],
  },
  {
    name: ST_OLAFS_CHURCH_NAME,
    coverKey: DEMO_IMAGE_KEYS.lake,
    gallery: [
      { caption: 'Tower above Old Town', imageKey: DEMO_IMAGE_KEYS.lake },
      { caption: 'Baptismal chapel', imageKey: DEMO_IMAGE_KEYS.signUp },
    ],
    serviceTimes: [
      { weekday: 7, time: '11:00', label: 'Sunday Worship & Youth Service', languageCode: 'et' },
      { weekday: 4, time: '19:00', label: 'Student Prayer Night', languageCode: 'et' },
    ],
    pastors: [
      {
        name: 'Pastor Johannes Rebane',
        role: 'Lead Pastor',
        introduction:
          'Lead pastor of the youth and student parish, teaching weekly and leading the Alpha course.',
      },
    ],
    events: [
      {
        offsetDays: 6,
        hour: 18,
        minute: 30,
        category: 'SPECIAL',
        title: 'Youth Alpha Kick-off',
        location: 'Old Town Hall, Lai 50',
        description:
          'First evening of the autumn Alpha course for students and young adults: food, a short talk, open questions.',
        registrationUrl: 'https://oleviste.ee/alpha',
        ctaLabel: 'Sign Up',
        languageCode: 'et',
      },
      {
        offsetDays: 12,
        hour: 17,
        minute: 0,
        category: 'COMMUNITY',
        title: 'Community Soup Kitchen',
        location: 'Parish Courtyard',
        description:
          'Volunteers serve a warm meal to anyone who comes. All are welcome, no questions asked.',
        languageCode: 'et',
      },
    ],
    announcements: [
      {
        title: 'Youth Alpha Registrations Open',
        body: 'Registration for the autumn Alpha course is open for students and young adults. Invite a friend — the first evening includes dinner.',
      },
    ],
    prayers: [
      {
        title: 'Prayer for the City’s Youth',
        introduction: 'Youth ministry prayer • Led by Pastor Johannes Rebane, St. Olaf’s Church',
        body: 'Lord Jesus, You welcomed the young with open arms. Watch over the youth of our city — those who study, those who work, those who search. Give them friends who are faithful, adults who listen, and hope that holds when days are hard. Amen.',
        audioKey: DEMO_AUDIO_KEYS.shepherd,
      },
    ],
  },
  {
    name: PARNU_CHURCH_NAME,
    coverKey: DEMO_IMAGE_KEYS.signUp,
    gallery: [
      { caption: 'Neo-baroque nave', imageKey: DEMO_IMAGE_KEYS.signUp },
      { caption: 'Organ loft', imageKey: DEMO_IMAGE_KEYS.sanctuary },
    ],
    serviceTimes: [
      { weekday: 7, time: '10:00', label: 'Sunday Eucharist', languageCode: 'et' },
      { weekday: 6, time: '18:00', label: 'Evening Organ Vespers', languageCode: 'et' },
    ],
    pastors: [
      {
        name: 'Rev. Katrin Lepp',
        role: 'Lead Pastor',
        introduction:
          'Lead pastor of the seaside parish, coordinating the summer concert season and choral devotions.',
      },
    ],
    events: [
      {
        offsetDays: 8,
        hour: 16,
        minute: 0,
        category: 'SPECIAL',
        title: 'Organ Recital Afternoon',
        location: 'Main Nave',
        description:
          'The parish organist plays a one-hour recital on the neo-baroque instrument, followed by refreshments.',
        registrationUrl: 'https://eliisabet.ee/recital',
        ctaLabel: 'Reserve a Seat',
        languageCode: 'et',
      },
    ],
    announcements: [
      {
        title: 'Organ Recital Season Announced',
        body: 'Saturday recitals continue through the season. Entry is free; a retiring collection supports the instrument’s upkeep.',
      },
    ],
    prayers: [
      {
        title: 'Prayer for Rest by the Sea',
        introduction: 'Evening prayer • Led by Rev. Katrin Lepp, Pärnu St. Elizabeth’s Church',
        body: 'Creator God, as the waves come and go, remind us that Your mercy is constant. Calm the restless hearts of those who came to this town to rest, and comfort those who carry sorrow even in the summer light. Give us sleep without fear and morning with hope. Amen.',
        audioKey: DEMO_AUDIO_KEYS.vespers,
      },
    ],
  },
]

const demoChecksum = (key: string) => `demo-${key.split('/').pop()}`

const timeOfDay = (time: string) => new Date(`1970-01-01T${time}:00Z`)

/** One media asset row per object key; reused by every seeder. */
export const ensureMediaAsset = async ({
  churchId,
  key,
  purpose,
  actorId,
}: {
  churchId: string
  key: string
  purpose: MediaPurpose
  actorId: string
}): Promise<MediaAsset> => {
  const existing = await db.mediaAsset.findUnique({ where: { object_key: key } })
  if (existing) return existing

  return db.mediaAsset.create({
    data: {
      church_id: churchId,
      object_key: key,
      purpose,
      mime_type: demoMediaContentType(key),
      byte_size: BigInt(demoMediaByteSize(key)),
      status: 'READY',
      checksum: demoChecksum(key),
      uploaded_by: actorId,
    },
  })
}

/**
 * Covers, galleries, service times, pastoral staff, events and announcements.
 * Everything is matched on a stable identity, so a re-run corrects drift instead
 * of duplicating rows.
 */
export const seedChurchContent = async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('seedChurchContent: admin missing')

  for (const content of DEMO_CHURCH_CONTENT) {
    const church = await db.church.findFirst({ where: { name: content.name } })
    if (!church) throw new Error(`seedChurchContent: church missing: ${content.name}`)

    // Cover — only when the church has none: an existing (real) cover is never
    // replaced by a demo image.
    const currentCover = church.cover_asset_id
      ? await db.mediaAsset.findUnique({ where: { id: church.cover_asset_id } })
      : null
    if (!currentCover) {
      const cover = await ensureMediaAsset({
        churchId: church.id,
        key: content.coverKey,
        purpose: 'IMAGE',
        actorId: admin.id,
      })
      await db.church.update({ where: { id: church.id }, data: { cover_asset_id: cover.id } })
    }

    // Gallery — replaced exactly, so a stale item cannot outlive the table
    const declared = await Promise.all(
      content.gallery.map((item, index) =>
        ensureMediaAsset({
          churchId: church.id,
          key: item.imageKey,
          purpose: 'IMAGE',
          actorId: admin.id,
        }).then((asset) => ({ ...item, asset, order_index: index })),
      ),
    )
    for (const item of declared) {
      const existing = await db.churchGalleryItem.findFirst({
        where: { church_id: church.id, order_index: item.order_index },
      })
      if (existing) {
        await db.churchGalleryItem.update({
          where: { id: existing.id },
          data: { media_asset_id: item.asset.id, caption: item.caption },
        })
      } else {
        await db.churchGalleryItem.create({
          data: {
            church_id: church.id,
            media_asset_id: item.asset.id,
            caption: item.caption,
            order_index: item.order_index,
          },
        })
      }
    }
    await db.churchGalleryItem.deleteMany({
      where: { church_id: church.id, order_index: { gte: declared.length } },
    })

    // Service times (only for a church that has none)
    const serviceTimeCount = await db.serviceTime.count({ where: { church_id: church.id } })
    if (serviceTimeCount === 0) {
      for (const st of content.serviceTimes) {
        await db.serviceTime.create({
          data: {
            church_id: church.id,
            weekday: st.weekday,
            local_time: timeOfDay(st.time),
            label: st.label,
            language_code: st.languageCode,
          },
        })
      }
    }

    // Pastoral staff
    for (const staff of content.pastors) {
      let pastor = await db.pastor.findFirst({ where: { name: staff.name } })
      if (!pastor) {
        pastor = await db.pastor.create({
          data: { name: staff.name, introduction: staff.introduction },
        })
      }
      const link = await db.churchPastor.findUnique({
        where: { church_id_pastor_id: { church_id: church.id, pastor_id: pastor.id } },
      })
      if (!link) {
        await db.churchPastor.create({
          data: { church_id: church.id, pastor_id: pastor.id, pastoral_role: staff.role },
        })
      } else if (link.pastoral_role !== staff.role) {
        await db.churchPastor.update({
          where: { church_id_pastor_id: { church_id: church.id, pastor_id: pastor.id } },
          data: { pastoral_role: staff.role },
        })
      }
    }

    // Events — re-dated on every run so the list always has upcoming items
    for (const ev of content.events) {
      const starts_at = new Date(Date.now() + ev.offsetDays * 24 * 60 * 60 * 1000)
      starts_at.setUTCHours(ev.hour, ev.minute, 0, 0)
      const data = {
        starts_at,
        location: ev.location,
        description: ev.description,
        registration_url: ev.registrationUrl ?? null,
        cta_label: ev.ctaLabel ?? null,
      }
      const existing = await db.event.findFirst({
        where: { church_id: church.id, title: ev.title },
      })
      if (existing) {
        await db.event.update({ where: { id: existing.id }, data })
      } else {
        await db.event.create({
          data: {
            church_id: church.id,
            category: ev.category,
            title: ev.title,
            language_code: ev.languageCode,
            ...data,
          },
        })
      }
    }

    // Announcements
    for (const a of content.announcements) {
      const existing = await db.announcement.findFirst({
        where: { church_id: church.id, title: a.title },
      })
      if (!existing) {
        await db.announcement.create({
          data: { church_id: church.id, title: a.title, body: a.body, published_at: new Date() },
        })
      }
    }

    console.log(
      `[seed] content ${content.name}: cover=${content.coverKey} gallery=${declared.length} ` +
        `pastors=${content.pastors.length} events=${content.events.length} ` +
        `announcements=${content.announcements.length}`,
    )
  }
}

/**
 * Prayers WITH playable audio — one published version, one approved audio row,
 * both pointed at by the prayer and its version. Runs after the voice-profile and
 * media seeds; throws rather than silently seeding a text-only prayer.
 */
export const seedChurchPrayers = async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('seedChurchPrayers: admin missing')
  const voice = await db.voiceProfile.findFirst({
    where: { registration_state: 'READY' },
    orderBy: { created_at: 'asc' },
  })
  if (!voice) {
    throw new Error('seedChurchPrayers: no READY voice profile — run the media/voice seeds first')
  }

  for (const content of DEMO_CHURCH_CONTENT) {
    const church = await db.church.findFirst({ where: { name: content.name } })
    if (!church) throw new Error(`seedChurchPrayers: church missing: ${content.name}`)

    const linked = await db.churchPastor.findFirst({ where: { church_id: church.id } })
    const pastor =
      (linked ? await db.pastor.findUnique({ where: { id: linked.pastor_id } }) : null) ??
      (await db.pastor.findFirst())
    if (!pastor) throw new Error(`seedChurchPrayers: no pastor for ${content.name}`)

    for (const def of content.prayers) {
      const audioAsset = await ensureMediaAsset({
        churchId: church.id,
        key: def.audioKey,
        purpose: 'GENERATED_AUDIO',
        actorId: admin.id,
      })

      let prayer = await db.prayer.findFirst({
        where: { church_id: church.id, versions: { some: { title: def.title } } },
      })
      if (!prayer) {
        prayer = await db.prayer.create({
          data: {
            slug: customSlugify({
              text: `${church.slug}-${def.title}`,
              isExists: false,
            }),
            church_id: church.id,
            created_by: admin.id,
            published_at: new Date(),
          },
        })
      }

      let version = await db.prayerVersion.findFirst({
        where: { prayer_id: prayer.id, title: def.title },
      })
      if (!version) {
        version = await db.prayerVersion.create({
          data: {
            prayer_id: prayer.id,
            version_number: 1,
            pastor_id: pastor.id,
            title: def.title,
            introduction: def.introduction,
            body: def.body,
            language_code: 'en',
            text_hash: demoChecksum(def.audioKey),
            approved_by: admin.id,
            approved_at: new Date(),
          },
        })
      } else {
        await db.prayerVersion.update({
          where: { id: version.id },
          data: { introduction: def.introduction, body: def.body },
        })
      }

      const audio = await db.prayerAudio.findFirst({ where: { prayer_version_id: version.id } })
      if (audio) {
        await db.prayerAudio.update({
          where: { id: audio.id },
          data: {
            asset_id: audioAsset.id,
            voice_profile_id: voice.id,
            status: 'APPROVED',
            approved_by: admin.id,
            approved_at: new Date(),
          },
        })
      } else {
        await db.prayerAudio.create({
          data: {
            prayer_version_id: version.id,
            voice_profile_id: voice.id,
            status: 'APPROVED',
            asset_id: audioAsset.id,
            provider_request_id: `demo_audio_${customSlugify({ text: def.title, isExists: false })}`,
            approved_by: admin.id,
            approved_at: new Date(),
          },
        })
      }

      await db.prayerVersion.update({
        where: { id: version.id },
        data: { selected_audio_id: audio?.id ?? (await currentAudioId(version.id)) },
      })
      await db.prayer.update({
        where: { id: prayer.id },
        data: {
          current_version_id: version.id,
          published_version_id: version.id,
          published_at: prayer.published_at ?? new Date(),
        },
      })
    }

    console.log(`[seed] prayers  ${content.name}: ${content.prayers.length} with approved audio`)
  }

  await assertPrayerAudio()
}

const currentAudioId = async (prayerVersionId: string) => {
  const row = await db.prayerAudio.findFirst({ where: { prayer_version_id: prayerVersionId } })
  if (!row) throw new Error(`seedChurchPrayers: audio row missing for version ${prayerVersionId}`)
  return row.id
}

/**
 * The regression gate for the bug this seed had: a published prayer with no
 * approved, selected audio is invisible as "no player" on every surface. Fail the
 * seed instead of shipping it.
 */
const assertPrayerAudio = async () => {
  const missing: string[] = []
  for (const content of DEMO_CHURCH_CONTENT) {
    const church = await db.church.findFirst({ where: { name: content.name } })
    if (!church) continue
    for (const def of content.prayers) {
      const prayer = await db.prayer.findFirst({
        where: { church_id: church.id, versions: { some: { title: def.title } } },
        include: { versions: { include: { selected_audio: true } } },
      })
      const version = prayer?.versions.find((v) => v.title === def.title)
      const ok =
        prayer?.published_at &&
        prayer.current_version_id === version?.id &&
        version?.selected_audio?.status === 'APPROVED' &&
        version.selected_audio.asset_id
      if (!ok) missing.push(`${content.name} / ${def.title}`)
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `seedChurchPrayers: published prayers without playable audio:\n  ${missing.join('\n  ')}`,
    )
  }
}

/** Points each demo church's pastor link at the READY voice profile. */
export const seedVoiceActivations = async () => {
  const voice = await db.voiceProfile.findFirst({
    where: { registration_state: 'READY' },
    orderBy: { created_at: 'asc' },
  })
  if (!voice) return

  for (const content of DEMO_CHURCH_CONTENT) {
    const church = await db.church.findFirst({ where: { name: content.name } })
    if (!church) continue
    const link = await db.churchPastor.findFirst({ where: { church_id: church.id } })
    if (!link || link.active_voice_profile_id === voice.id) continue
    await db.churchPastor.update({
      where: { church_id_pastor_id: { church_id: church.id, pastor_id: link.pastor_id } },
      data: { active_voice_profile_id: voice.id },
    })
  }
}
