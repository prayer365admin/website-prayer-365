/**
 * Static copy and mock structure for the /welcome landing page (Figma node 87-8752).
 *
 * Per SPEC:
 * - Real data is used when available via existing server controllers (audio prayer, member count).
 * - When an API exists but returns null, render "Data not available" / "No open prayer available yet."
 * - Where no API exists in the system (church chips, testimonials, static marketing copy, schedule blocks),
 *   this registry supplies the exact Figma design strings.
 */

export const CHURCH_NETWORK_CHIPS = [
  "St. John's Church, Tallinn",
  "St. Michael's Swedish Parish",
  'Helsinki Old Church & Coast Deanery',
  "St. Peter's Congregation, Tartu",
  'Riga Dome Cathedral Partner Fellowship',
]

export interface ScheduleBlock {
  title: string
  time: string
}

export const LITURGY_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { title: 'Morning Matins', time: '06:30 Daily' },
  { title: 'Midday Angelus', time: '12:00 Daily' },
  { title: 'Evening Compline', time: '21:00 Daily' },
]

export interface AppFeature {
  title: string
  hint: string
}

export const APP_FEATURES: AppFeature[] = [
  {
    title: '06:30 Scripture Gentle Push',
    hint: 'Wake to consecrated lectionary verse.',
  },
  {
    title: 'Offline Liturgy Playback',
    hint: 'Pre-cache hymns and homilies for travel',
  },
  {
    title: 'Parish Bell Chime Prompts',
    hint: 'Authentic acoustic bell reminders at noon.',
  },
  {
    title: 'Pocket Intercession',
    hint: 'Encrypted chaplain requests on the go.',
  },
]

export interface Testimonial {
  quote: string
  author: string
  role: string
  avatarUrl: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      '“Prayer 365 has restored the rhythm of daily Matins for our dispersed diaspora congregation. Even when miles apart, our flock prays the same words at dawn.”',
    author: 'Rev. Thomas Lindqvist',
    role: "Vicar, St. Michael's Swedish Parish",
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces&auto=format&q=80',
  },
  {
    quote:
      '“The confidential prayer wall has provided our young people a safe, sacred place to share deep anxieties and receive gentle chaplain guidance without judgment.”',
    author: 'Diaconal Sister Kristiina',
    role: 'Youth Ministry, Tallinn Deanery',
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces&auto=format&q=80',
  },
  {
    quote:
      '“Listening to Compline through headphones on my evening commute transforms public transit into a quiet cathedral. A sanctuary in the pocket.”',
    author: 'Mart Tamm',
    role: 'Lay Pilgrim, Tartu',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces&auto=format&q=80',
  },
]

export interface MosaicTile {
  eyebrow: string
  title: string
  description: string
  imageSrc: string
}

export const MOSAIC_TILES: MosaicTile[] = [
  {
    eyebrow: 'CHORAL VESPERS & LITURGY',
    title: 'Light Across Ancient Stone',
    description:
      'Historic sanctuaries bathed in jewel-toned morning reflections across Tallinn & Riga.',
    imageSrc: '/images/church.jpeg',
  },
  {
    eyebrow: 'SACRED RESTORATION',
    title: 'Contemporary Sanctuary Space',
    description: 'Modern timber architecture welcoming contemplative silence and fellowship.',
    imageSrc: '/images/viimsi-church-indoor.jpeg',
  },
  {
    eyebrow: 'CONTEMPLATIVE RETREAT',
    title: 'Quiet Water Pilgrimages',
    description: 'Coastal stillness and outdoor prayer along the Baltic coastline.',
    imageSrc: '/images/wb3-devotional-lake.png',
  },
]

export const PASTOR_AVATARS = [
  '/images/pastor-1.jpg',
  '/images/pastor-2.jpg',
  '/images/pastor-3.jpg',
]

export const SCRIPTURE_BLESSING = {
  quote:
    '“The Lord bless you and keep you; the Lord make his face shine upon you and be gracious to you.”',
  attribution: 'NUMBERS 6:24-25 • THE AARONIC BLESSING',
}

export const FOOTER_DATA = {
  hotline: '+372 644 1483',
  hotlineLabel: '24/7 Spiritual Hotline',
  hotlineNote: 'Confidential chaplain consultation',
  brandSubtitle: 'Ecumenical Portal',
  verse:
    '“The Lord bless you and keep you; the Lord make his face shine upon you and be gracious to you.”',
  verseReference: 'Numbers 6:24-25 • In fellowship with EELK Baltic & Nordic Ecumenical Council',
  parishLinks: [
    { label: 'Tallinn Deanery Directory', href: '/churches' },
    { label: 'Helsinki Diocese Partners', href: '/churches' },
    { label: 'Diaconal Food & Shelter Fund', href: '/donate' },
    { label: 'Youth Ministry Gatherings', href: '/prayers' },
  ],
  legalLinks: [
    { label: 'Privacy of Confession', href: '/privacy' },
    { label: 'Terms of Fellowship', href: '/terms' },
    { label: 'Pastoral Support', href: '/support' },
  ],
}
