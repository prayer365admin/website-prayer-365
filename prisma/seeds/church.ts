import { db } from '../../src/utils/db-connection'
import customSlugify from '../../src/utils/slugify'
import { DEMO_CHURCH_NAME, DEMO_CHURCH_NODE_NAME, getAdminUser } from './test-context'

// Second church for multi-church manual-testing (CH-04 selector needs >= 2
// churches under one scope). One CHURCH org node keeps the single-church
// account (prayer_church_admin) scoped to Tallinn only.
const SECOND_CHURCH_NAME = 'Tartu Demo Church'
const SECOND_CHURCH_NODE_NAME = 'Tartu Demo Church Node'

const seedSlug = (text: string) => customSlugify({ text, isExists: false })

export const TALLINN_CHURCH_PROFILE = {
  status: 'APPROVED' as const,
  timezone: 'Europe/Tallinn',
  denomination: 'Lutheran (EELK)',
  church_style: 'Historic 14th Century',
  description:
    'Historic cathedral atop Toompea Hill, founded in the early 13th century. An enduring sanctuary of quiet presence, community refuge, organ praise, and continuous prayer overlooking the capital.',
  address: {
    line1: 'Toom-Kooli 6',
    line2: 'Toompea',
    city: 'Tallinn',
    postalCode: '10130',
    countryCode: 'EE',
  },
  latitude: 59.4371,
  longitude: 24.7391,
  contacts: {
    email: 'tallinna.toom@eelk.ee',
    phone: '+372 644 4140',
  },
  website: 'https://toomkirik.ee',
  social_links: [
    { label: 'Facebook', url: 'https://facebook.com/tallinnatoomkirik' },
    { label: 'YouTube', url: 'https://youtube.com/@tallinnatoomkirik' },
  ],
  sunday_live_stream: true,
  taize_chants: true,
  youth_ministry: true,
}

export const TALLINN_SERVICE_TIMES = [
  {
    weekday: 7,
    local_time: new Date('1970-01-01T10:00:00Z'),
    label: 'Sunday Divine Service with Holy Communion',
    language_code: 'et',
  },
  {
    weekday: 7,
    local_time: new Date('1970-01-01T17:00:00Z'),
    label: 'Evening Choral Contemplation & Organ',
    language_code: 'et',
  },
  {
    weekday: 3,
    local_time: new Date('1970-01-01T18:30:00Z'),
    label: 'Midweek Taizé Prayer & Devotion',
    language_code: 'et',
  },
  {
    weekday: 6,
    local_time: new Date('1970-01-01T12:00:00Z'),
    label: 'Midday Organ Meditation & Prayer',
    language_code: 'et',
  },
]

export const TARTU_CHURCH_PROFILE = {
  status: 'APPROVED' as const,
  timezone: 'Europe/Tallinn',
  denomination: 'Lutheran (EELK)',
  church_style: 'Contemporary Ecumenical',
  description:
    'Historic 14th-century brick-Gothic sanctuary in the heart of Tartu Old Town, renowned for its thousands of medieval terracotta sculptures, vibrant organ concerts, and welcoming parish fellowship.',
  address: {
    line1: 'Jaani 5',
    line2: null,
    city: 'Tartu',
    postalCode: '51007',
    countryCode: 'EE',
  },
  latitude: 58.3831,
  longitude: 26.7214,
  contacts: {
    email: 'tartu.jaani@eelk.ee',
    phone: '+372 744 1980',
  },
  website: 'https://tartujaani.ee',
  social_links: [{ label: 'Facebook', url: 'https://facebook.com/tartujaani' }],
  sunday_live_stream: true,
  taize_chants: true,
  youth_ministry: true,
}

export const TARTU_SERVICE_TIMES = [
  {
    weekday: 7,
    local_time: new Date('1970-01-01T10:00:00Z'),
    label: 'Sunday Eucharist Liturgy',
    language_code: 'et',
  },
  {
    weekday: 4,
    local_time: new Date('1970-01-01T18:00:00Z'),
    label: 'Evening Prayer & Vespers',
    language_code: 'et',
  },
]

export const seedChurches = async () => {
  const coverAsset = await db.mediaAsset.findFirst({
    where: {
      purpose: 'IMAGE',
      OR: [{ object_key: '/images/church.jpeg' }, { object_key: { contains: DEMO_CHURCH_NAME } }],
    },
    orderBy: { created_at: 'desc' },
  })

  const existing = await db.church.findFirst({ where: { name: DEMO_CHURCH_NAME } })
  let churchId: string
  if (existing) {
    await db.church.update({
      where: { id: existing.id },
      data: {
        ...TALLINN_CHURCH_PROFILE,
        ...(coverAsset ? { cover_asset_id: coverAsset.id } : {}),
      },
    })
    churchId = existing.id
  } else {
    const node = await db.orgNode.findFirst({ where: { name: DEMO_CHURCH_NODE_NAME } })
    const admin = await getAdminUser()
    if (!node || !admin) throw new Error('seedChurches: org node / admin missing')

    const church = await db.church.create({
      data: {
        org_node_id: node.id,
        name: DEMO_CHURCH_NAME,
        slug: seedSlug(DEMO_CHURCH_NAME),
        approved_by: admin.id,
        approved_at: new Date(),
        ...TALLINN_CHURCH_PROFILE,
        cover_asset_id: coverAsset?.id ?? null,
      },
    })
    churchId = church.id
  }

  for (const language_code of ['et', 'en', 'sv', 'fi']) {
    const lang = await db.churchLanguage.findFirst({
      where: { church_id: churchId, language_code },
    })
    if (!lang) {
      await db.churchLanguage.create({ data: { church_id: churchId, language_code } })
    }
  }

  for (const st of TALLINN_SERVICE_TIMES) {
    const existingSt = await db.serviceTime.findFirst({
      where: { church_id: churchId, weekday: st.weekday, local_time: st.local_time },
    })
    if (!existingSt) {
      await db.serviceTime.create({ data: { church_id: churchId, ...st } })
    } else {
      await db.serviceTime.update({
        where: { id: existingSt.id },
        data: { label: st.label, language_code: st.language_code },
      })
    }
  }
}

/** Second church (sibling CHURCH node) so global/diocese accounts get a selector. */
export const seedSecondChurch = async () => {
  const existing = await db.church.findFirst({ where: { name: SECOND_CHURCH_NAME } })
  let churchId: string
  if (existing) {
    await db.church.update({
      where: { id: existing.id },
      data: TARTU_CHURCH_PROFILE,
    })
    churchId = existing.id
  } else {
    const deanery = await db.orgNode.findFirst({
      where: { kind: 'DEANERY', name: 'Estonia Deanery' },
    })
    const admin = await getAdminUser()
    if (!deanery || !admin) throw new Error('seedSecondChurch: deanery node / admin missing')

    let node = await db.orgNode.findFirst({ where: { name: SECOND_CHURCH_NODE_NAME } })
    if (!node) {
      node = await db.orgNode.create({
        data: { kind: 'CHURCH', name: SECOND_CHURCH_NODE_NAME, parent_id: deanery.id },
      })
    }

    const church = await db.church.create({
      data: {
        org_node_id: node.id,
        name: SECOND_CHURCH_NAME,
        slug: seedSlug(SECOND_CHURCH_NAME),
        approved_by: admin.id,
        approved_at: new Date(),
        ...TARTU_CHURCH_PROFILE,
      },
    })
    churchId = church.id
  }

  for (const language_code of ['et', 'en']) {
    const lang = await db.churchLanguage.findFirst({
      where: { church_id: churchId, language_code },
    })
    if (!lang) {
      await db.churchLanguage.create({ data: { church_id: churchId, language_code } })
    }
  }

  for (const st of TARTU_SERVICE_TIMES) {
    const existingSt = await db.serviceTime.findFirst({
      where: { church_id: churchId, weekday: st.weekday, local_time: st.local_time },
    })
    if (!existingSt) {
      await db.serviceTime.create({ data: { church_id: churchId, ...st } })
    } else {
      await db.serviceTime.update({
        where: { id: existingSt.id },
        data: { label: st.label, language_code: st.language_code },
      })
    }
  }
}

export const ST_JOHNS_CHURCH_NAME = "St. John's Church"
export const ST_JOHNS_CHURCH_NODE_NAME = "St. John's Church Node"

export const ST_JOHNS_CHURCH_PROFILE = {
  status: 'APPROVED' as const,
  timezone: 'Europe/Tallinn',
  denomination: 'Lutheran (EELK)',
  church_style: 'Contemporary Ecumenical',
  description:
    "A living sanctuary of quiet presence, community refuge, and continuous prayer amidst the rhythm of the city. Whether you seek the thunderous transcendence of our 1867 Walcker pipe organ, a candlelit corner in the crypt for silent tears and thanksgiving, or a fellowship meal with brothers and sisters in Christ, our doors at Freedom Square are open to you. In Christ's peace, enter and be still.\n\nNeo-Gothic parish sanctuary founded in 1867. A home of continuous liturgical praise, historic pipe organ mastery, and unceasing daily intercession.",
  address: {
    line1: 'Vabaduse väljak 1',
    line2: 'Freedom Square, City Center',
    city: 'Tallinn',
    postalCode: '10146',
    countryCode: 'EE',
  },
  latitude: 59.4343,
  longitude: 24.7453,
  contacts: {
    email: 'tallinna.jaani@eelk.ee',
    phone: '+372 644 6211',
  },
  website: 'https://tallinnajaani.ee',
  social_links: [
    { label: 'Facebook', url: 'https://facebook.com/tallinnajaanikirik' },
    { label: 'YouTube', url: 'https://youtube.com/@tallinnajaanikirik' },
  ],
  sunday_live_stream: true,
  taize_chants: true,
  youth_ministry: true,
}

export const ST_JOHNS_SERVICE_TIMES = [
  {
    weekday: 7,
    local_time: new Date('1970-01-01T10:00:00Z'),
    label: 'Sunday Divine Service with Holy Communion',
    language_code: 'et',
  },
  {
    weekday: 7,
    local_time: new Date('1970-01-01T17:00:00Z'),
    label: 'Evening Choral Contemplation & Organ',
    language_code: 'et',
  },
  {
    weekday: 3,
    local_time: new Date('1970-01-01T18:30:00Z'),
    label: 'Midweek Taizé Vigil & Prayer',
    language_code: 'et',
  },
  {
    weekday: 6,
    local_time: new Date('1970-01-01T12:00:00Z'),
    label: 'Midday Organ Meditation & Prayer',
    language_code: 'et',
  },
  {
    weekday: 1,
    local_time: new Date('1970-01-01T12:00:00Z'),
    label: 'Daily Midday Altar Prayer',
    language_code: 'et',
  },
]

export const ST_JOHNS_STAFF = [
  {
    name: 'Rev. Daniel Mäkinen',
    role: 'Lead Pastor & Deanery Provost',
    introduction:
      "Lead Pastor and Provost at St. John's Church, serving Freedom Square and Tallinn Deanery.",
  },
  {
    name: 'Chaplain Eva Reinla',
    role: 'Diaconal & Family Care',
    introduction:
      'Chaplain coordinating diaconal outreach, elder support, and family pastoral care.',
  },
  {
    name: 'Dr. Tiia Tenno',
    role: 'Director of Sacred Music',
    introduction:
      "Master organist and director of choral and sacred music traditions at St. John's Church.",
  },
]

export const ST_JOHNS_GALLERY = [
  { caption: 'Central Nave & Neo-Gothic Vaults', order_index: 0 },
  { caption: '1867 Walcker Pipe Organ', order_index: 1 },
  { caption: 'Chancel Stained Glass', order_index: 2 },
  { caption: 'Crypt Intercession Corner', order_index: 3 },
  { caption: 'Tower & Spire over Freedom Square', order_index: 4 },
]

export const ST_JOHNS_EVENTS = [
  {
    offsetDays: 3,
    hour: 18,
    minute: 30,
    category: 'SERVICE' as const,
    title: 'Baltic Ecumenical Youth Vespers',
    location: 'Freedom Square Sanctuary',
    description:
      'Gathering young adults from Helsinki, Riga, and Tallinn for ecumenical evening prayer, quiet candlelight meditation, and fellowship.',
    registration_url: 'https://tallinnajaani.ee/fellowship',
    cta_label: 'RSVP Fellowship',
    language_code: 'et',
  },
  {
    offsetDays: 10,
    hour: 17,
    minute: 0,
    category: 'SPECIAL' as const,
    title: "All Souls' Memorial Requiem",
    location: 'Central Nave',
    description:
      "Chamber orchestra and choir performing Fauré's Requiem in remembrance of departed loved ones under the nave vaults.",
    registration_url: 'https://tallinnajaani.ee/memorial',
    cta_label: 'Submit Memorial Name',
    language_code: 'et',
  },
  {
    offsetDays: 17,
    hour: 14,
    minute: 0,
    category: 'COMMUNITY' as const,
    title: 'Diaconal Senior Tea & Scripture',
    location: 'Crypt Fellowship Hall',
    description:
      'Weekly fellowship circle, pastoral counseling, and warm hospitality for seniors and community members.',
    registration_url: 'https://tallinnajaani.ee/care',
    cta_label: 'Volunteer Care',
    language_code: 'et',
  },
]

export const ST_JOHNS_ANNOUNCEMENTS = [
  {
    title: 'Walcker Organ Autumn Tuning Completed',
    body: 'Sanctuary Maintenance: Master organ builder finished reed voicing. All 4,800 pipes sounding in full glory for upcoming Sunday liturgies and midweek organ recitals.',
  },
  {
    title: 'Sunday Church School Registration',
    body: 'Children & Family: Ages 4–12 meet concurrently with Sunday 10:00 service in Crypt Hall B. Registration open for the new semester.',
  },
]

export const ST_JOHNS_PRAYERS = [
  {
    title: 'Peace in Uncertain Times',
    introduction:
      'Scripture meditation on Philippians 4:6–7 • Led by Pastor Daniel Carter, Hope Church',
    body: "Scripture meditation on Philippians 4:6–7. Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus. Heavenly Father, calm our restless minds, still our anxious hearts, and envelop our spirits with Your transcendent peace that surpasses all earthly understanding. In Christ's holy name we pray. Amen.",
    pastor_name: 'Rev. Daniel Mäkinen',
    audio_key: '/audio/peace-in-uncertain-times.mp3',
    byte_size: 960000,
  },
  {
    title: 'The Shepherd’s Protection & Still Waters',
    introduction: "Psalm 23 Contemplation • Led by Rev. Daniel Mäkinen, St. John's Church",
    body: "Psalm 23 meditation. The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul. He leads me in paths of righteousness for His name's sake. Even though I walk through the valley of the shadow of death, I will fear no evil, for You are with me; Your rod and Your staff, they comfort me. Lord, walk beside us in darkness, restore our strength, and lead us into Your eternal light. Amen.",
    pastor_name: 'Rev. Daniel Mäkinen',
    audio_key: '/audio/shepherds-protection.mp3',
    byte_size: 720000,
  },
  {
    title: 'Morning Liturgy & Eucharist Preparation',
    introduction:
      "Liturgical preparation for Holy Communion • Led by Rev. Daniel Mäkinen, St. John's Church",
    body: 'Lord Jesus Christ, Holy Bread of eternal life and Cup of salvation, prepare our hearts to approach Your holy altar with pure devotion, humble reverence, and joyful thanksgiving. Feed our hungry souls, forgive our transgressions, and knit us together as one holy fellowship in Your divine love. Amen.',
    pastor_name: 'Rev. Daniel Mäkinen',
    audio_key: '/audio/morning-liturgy.mp3',
    byte_size: 800000,
  },
  {
    title: 'Choral Organ Vespers & Evening Stillness',
    introduction: "Compline night vigil • Led by Chaplain Eva Reinla, St. John's Church",
    body: 'Into Your hands, Lord, we commend our spirits as night descends upon the sanctuary. Keep us as the apple of Your eye; hide us under the shadow of Your wings. Grant rest to the weary, peace to the dying, comfort to the grieving, and holy rest to all Your faithful servants. In the name of the Father, Son, and Holy Spirit. Amen.',
    pastor_name: 'Chaplain Eva Reinla',
    audio_key: '/audio/choral-vespers.mp3',
    byte_size: 880000,
  },
]

/** Third church: St. John's Church (Parish Profile & Sanctuary matching W08 Figma). */
export const seedStJohnsChurch = async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('seedStJohnsChurch: admin missing')

  // Cover asset
  let coverAsset = await db.mediaAsset.findUnique({
    where: { object_key: '/images/st-johns-church.jpeg' },
  })
  const existing = await db.church.findFirst({ where: { name: ST_JOHNS_CHURCH_NAME } })
  let churchId: string

  if (existing) {
    await db.church.update({
      where: { id: existing.id },
      data: {
        ...ST_JOHNS_CHURCH_PROFILE,
        ...(coverAsset ? { cover_asset_id: coverAsset.id } : {}),
      },
    })
    churchId = existing.id
  } else {
    let deanery = await db.orgNode.findFirst({
      where: { kind: 'DEANERY', name: 'Tallinn Deanery' },
    })
    if (!deanery) {
      const diocese = await db.orgNode.findFirst({
        where: { kind: 'DIOCESE', name: 'Estonia Diocese' },
      })
      if (diocese) {
        deanery = await db.orgNode.create({
          data: { kind: 'DEANERY', name: 'Tallinn Deanery', parent_id: diocese.id },
        })
      } else {
        deanery = await db.orgNode.findFirst({ where: { kind: 'DEANERY' } })
      }
    }
    if (!deanery) throw new Error('seedStJohnsChurch: deanery node missing')

    let node = await db.orgNode.findFirst({ where: { name: ST_JOHNS_CHURCH_NODE_NAME } })
    if (!node) {
      node = await db.orgNode.create({
        data: { kind: 'CHURCH', name: ST_JOHNS_CHURCH_NODE_NAME, parent_id: deanery.id },
      })
    }

    const church = await db.church.create({
      data: {
        org_node_id: node.id,
        name: ST_JOHNS_CHURCH_NAME,
        slug: seedSlug(ST_JOHNS_CHURCH_NAME),
        approved_by: admin.id,
        approved_at: new Date(),
        ...ST_JOHNS_CHURCH_PROFILE,
        cover_asset_id: coverAsset?.id ?? null,
      },
    })
    churchId = church.id
  }

  if (!coverAsset) {
    coverAsset = await db.mediaAsset.create({
      data: {
        church_id: churchId,
        object_key: '/images/st-johns-church.jpeg',
        purpose: 'IMAGE',
        mime_type: 'image/jpeg',
        byte_size: BigInt(50388),
        status: 'READY',
        checksum: '41e8f23b32cba394ab67f8326d218667',
        uploaded_by: admin.id,
      },
    })
    await db.church.update({
      where: { id: churchId },
      data: { cover_asset_id: coverAsset.id },
    })
  }

  // Languages
  for (const language_code of ['et', 'en', 'sv', 'fi']) {
    const lang = await db.churchLanguage.findFirst({
      where: { church_id: churchId, language_code },
    })
    if (!lang) {
      await db.churchLanguage.create({ data: { church_id: churchId, language_code } })
    }
  }

  // Service times
  for (const st of ST_JOHNS_SERVICE_TIMES) {
    const existingSt = await db.serviceTime.findFirst({
      where: { church_id: churchId, weekday: st.weekday, local_time: st.local_time },
    })
    if (!existingSt) {
      await db.serviceTime.create({ data: { church_id: churchId, ...st } })
    } else {
      await db.serviceTime.update({
        where: { id: existingSt.id },
        data: { label: st.label, language_code: st.language_code },
      })
    }
  }

  // Staff (Pastoral Care Office)
  for (const staff of ST_JOHNS_STAFF) {
    let pastor = await db.pastor.findFirst({ where: { name: staff.name } })
    if (!pastor) {
      pastor = await db.pastor.create({
        data: {
          name: staff.name,
          introduction: staff.introduction,
        },
      })
    }
    const link = await db.churchPastor.findUnique({
      where: {
        church_id_pastor_id: {
          church_id: churchId,
          pastor_id: pastor.id,
        },
      },
    })
    if (!link) {
      await db.churchPastor.create({
        data: {
          church_id: churchId,
          pastor_id: pastor.id,
          pastoral_role: staff.role,
        },
      })
    } else {
      await db.churchPastor.update({
        where: {
          church_id_pastor_id: {
            church_id: churchId,
            pastor_id: pastor.id,
          },
        },
        data: { pastoral_role: staff.role },
      })
    }
  }

  // Gallery items (use same picture as cover)
  for (const item of ST_JOHNS_GALLERY) {
    const existingGalleryItem = await db.churchGalleryItem.findFirst({
      where: { church_id: churchId, order_index: item.order_index },
    })
    if (!existingGalleryItem) {
      await db.churchGalleryItem.create({
        data: {
          church_id: churchId,
          media_asset_id: coverAsset.id,
          caption: item.caption,
          order_index: item.order_index,
        },
      })
    } else {
      await db.churchGalleryItem.update({
        where: { id: existingGalleryItem.id },
        data: { caption: item.caption, media_asset_id: coverAsset.id },
      })
    }
  }

  // Events
  for (const ev of ST_JOHNS_EVENTS) {
    const starts_at = new Date(Date.now() + ev.offsetDays * 24 * 60 * 60 * 1000)
    starts_at.setUTCHours(ev.hour, ev.minute, 0, 0)

    const existingEv = await db.event.findFirst({
      where: { church_id: churchId, title: ev.title },
    })
    if (!existingEv) {
      await db.event.create({
        data: {
          church_id: churchId,
          category: ev.category,
          title: ev.title,
          description: ev.description,
          starts_at,
          location: ev.location,
          registration_url: ev.registration_url,
          cta_label: ev.cta_label,
          language_code: ev.language_code,
        },
      })
    } else {
      await db.event.update({
        where: { id: existingEv.id },
        data: {
          starts_at,
          location: ev.location,
          description: ev.description,
          registration_url: ev.registration_url,
          cta_label: ev.cta_label,
        },
      })
    }
  }

  // Announcements
  for (const a of ST_JOHNS_ANNOUNCEMENTS) {
    const existingAnn = await db.announcement.findFirst({
      where: { church_id: churchId, title: a.title },
    })
    if (!existingAnn) {
      await db.announcement.create({
        data: {
          church_id: churchId,
          title: a.title,
          body: a.body,
          published_at: new Date(),
        },
      })
    }
  }

  // Voice profile: look up voice from other pastor seeder (seedVoiceProfiles)
  let voiceProfile = await db.voiceProfile.findFirst({
    where: { registration_state: 'READY' },
  })
  if (!voiceProfile) {
    const demoVoice = await db.voiceProfile.findFirst()
    if (demoVoice) {
      voiceProfile = demoVoice
    }
  }

  // Seed all prayers with generated text and audio
  for (let i = 0; i < ST_JOHNS_PRAYERS.length; i++) {
    const pDef = ST_JOHNS_PRAYERS[i]

    let audioAsset = await db.mediaAsset.findUnique({ where: { object_key: pDef.audio_key } })
    if (!audioAsset) {
      audioAsset = await db.mediaAsset.create({
        data: {
          church_id: churchId,
          object_key: pDef.audio_key,
          purpose: 'GENERATED_AUDIO',
          mime_type: 'audio/mpeg',
          byte_size: BigInt(pDef.byte_size),
          status: 'READY',
          checksum: `st-johns-audio-checksum-${i}`,
          uploaded_by: admin.id,
        },
      })
    }

    const assignedPastor =
      (await db.pastor.findFirst({ where: { name: pDef.pastor_name } })) ??
      (await db.pastor.findFirst({ where: { name: 'Rev. Daniel Mäkinen' } })) ??
      (await db.pastor.findFirst())
    if (!assignedPastor) continue

    let prayer = await db.prayer.findFirst({
      where: {
        church_id: churchId,
        versions: { some: { title: pDef.title } },
      },
    })

    if (!prayer) {
      prayer = await db.prayer.create({
        data: {
          church_id: churchId,
          created_by: admin.id,
          published_at: new Date(Date.now() - i * 3600 * 1000),
        },
      })
    }

    let version = await db.prayerVersion.findFirst({
      where: { prayer_id: prayer.id, title: pDef.title },
    })
    if (!version) {
      version = await db.prayerVersion.create({
        data: {
          prayer_id: prayer.id,
          version_number: 1,
          pastor_id: assignedPastor.id,
          title: pDef.title,
          introduction: pDef.introduction,
          body: pDef.body,
          language_code: 'et',
          text_hash: `st-johns-prayer-hash-${i}`,
          approved_by: admin.id,
          approved_at: new Date(),
        },
      })
    } else {
      await db.prayerVersion.update({
        where: { id: version.id },
        data: {
          introduction: pDef.introduction,
          body: pDef.body,
        },
      })
    }

    if (voiceProfile && audioAsset) {
      let audio = await db.prayerAudio.findFirst({
        where: { prayer_version_id: version.id },
      })
      if (!audio) {
        audio = await db.prayerAudio.create({
          data: {
            prayer_version_id: version.id,
            voice_profile_id: voiceProfile.id,
            status: 'APPROVED',
            asset_id: audioAsset.id,
            provider_request_id: `st_johns_gen_req_${i}`,
            approved_by: admin.id,
            approved_at: new Date(),
          },
        })
      } else {
        await db.prayerAudio.update({
          where: { id: audio.id },
          data: { asset_id: audioAsset.id },
        })
      }
      await db.prayerVersion.update({
        where: { id: version.id },
        data: { selected_audio_id: audio.id },
      })
    }

    await db.prayer.update({
      where: { id: prayer.id },
      data: { current_version_id: version.id, published_version_id: version.id },
    })
  }

  // Activate voice profile for Lead Pastor
  if (voiceProfile) {
    const pastorLink = await db.churchPastor.findFirst({
      where: { church_id: churchId, pastor: { name: 'Rev. Daniel Mäkinen' } },
    })
    if (pastorLink) {
      await db.churchPastor.update({
        where: { church_id_pastor_id: { church_id: churchId, pastor_id: pastorLink.pastor_id } },
        data: { active_voice_profile_id: voiceProfile.id },
      })
    }
  }

  return churchId
}

export const ST_OLAFS_CHURCH_NAME = "St. Olaf's Church"
export const ST_OLAFS_CHURCH_NODE_NAME = "St. Olaf's Church Node"
export const ST_OLAFS_CHURCH_PROFILE = {
  status: 'APPROVED' as const,
  timezone: 'Europe/Tallinn',
  denomination: 'Baptist (EEKBKL)',
  church_style: 'Youth & Student Parish',
  description:
    'Historic 13th-century church once known as the tallest building in medieval Europe. A beacon of active evangelical faith, youth ministry, and community outreach in northern Tallinn Old Town.',
  address: {
    line1: 'Lai 50',
    line2: 'Old Town',
    city: 'Tallinn',
    postalCode: '10133',
    countryCode: 'EE',
  },
  latitude: 59.4414,
  longitude: 24.7478,
  contacts: {
    email: 'oleviste@oleviste.ee',
    phone: '+372 641 2241',
  },
  website: 'https://oleviste.ee',
  social_links: [{ label: 'Facebook', url: 'https://facebook.com/olevistekirik' }],
  sunday_live_stream: true,
  taize_chants: false,
  youth_ministry: true,
}

export const PARNU_CHURCH_NAME = "Pärnu St. Elizabeth's Church"
export const PARNU_CHURCH_NODE_NAME = 'Pärnu Church Node'
export const PARNU_CHURCH_PROFILE = {
  status: 'APPROVED' as const,
  timezone: 'Europe/Tallinn',
  denomination: 'Lutheran (EELK)',
  church_style: 'Contemporary Ecumenical',
  description:
    'One of the finest baroque sacral buildings in the Baltics, renowned for exceptional neo-baroque organ acoustics, active choral tradition, and summer festival devotions.',
  address: {
    line1: 'Nikolai 22',
    line2: null,
    city: 'Pärnu',
    postalCode: '80010',
    countryCode: 'EE',
  },
  latitude: 58.3849,
  longitude: 24.4994,
  contacts: {
    email: 'parnu.eliisabeti@eelk.ee',
    phone: '+372 443 1381',
  },
  website: 'https://eliisabet.ee',
  social_links: [{ label: 'Facebook', url: 'https://facebook.com/eliisabetikogudus' }],
  sunday_live_stream: false,
  taize_chants: true,
  youth_ministry: false,
}

export const seedAdditionalChurches = async () => {
  const admin = await getAdminUser()
  if (!admin) throw new Error('seedAdditionalChurches: admin missing')

  let deanery = await db.orgNode.findFirst({
    where: { kind: 'DEANERY', name: 'Tallinn Deanery' },
  })
  if (!deanery) {
    deanery = await db.orgNode.findFirst({ where: { kind: 'DEANERY' } })
  }
  if (!deanery) throw new Error('seedAdditionalChurches: deanery node missing')

  // 1. St. Olaf's Church
  const existingOlaf = await db.church.findFirst({ where: { name: ST_OLAFS_CHURCH_NAME } })
  if (existingOlaf) {
    await db.church.update({
      where: { id: existingOlaf.id },
      data: ST_OLAFS_CHURCH_PROFILE,
    })
  } else {
    let node = await db.orgNode.findFirst({ where: { name: ST_OLAFS_CHURCH_NODE_NAME } })
    if (!node) {
      node = await db.orgNode.create({
        data: { kind: 'CHURCH', name: ST_OLAFS_CHURCH_NODE_NAME, parent_id: deanery.id },
      })
    }
    await db.church.create({
      data: {
        org_node_id: node.id,
        name: ST_OLAFS_CHURCH_NAME,
        slug: seedSlug(ST_OLAFS_CHURCH_NAME),
        approved_by: admin.id,
        approved_at: new Date(),
        ...ST_OLAFS_CHURCH_PROFILE,
      },
    })
  }

  // 2. Pärnu St. Elizabeth's Church
  const existingParnu = await db.church.findFirst({ where: { name: PARNU_CHURCH_NAME } })
  if (existingParnu) {
    await db.church.update({
      where: { id: existingParnu.id },
      data: PARNU_CHURCH_PROFILE,
    })
  } else {
    let node = await db.orgNode.findFirst({ where: { name: PARNU_CHURCH_NODE_NAME } })
    if (!node) {
      node = await db.orgNode.create({
        data: { kind: 'CHURCH', name: PARNU_CHURCH_NODE_NAME, parent_id: deanery.id },
      })
    }
    await db.church.create({
      data: {
        org_node_id: node.id,
        name: PARNU_CHURCH_NAME,
        slug: seedSlug(PARNU_CHURCH_NAME),
        approved_by: admin.id,
        approved_at: new Date(),
        ...PARNU_CHURCH_PROFILE,
      },
    })
  }
}
