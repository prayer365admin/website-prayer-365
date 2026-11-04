import { EventCategory } from '@/models/event'

export const ID_COLUMN_WIDTH = 80
export const ACTION_COLUMN_WIDTH = 125
export const USER_MANAGEMENT_ACTION_WIDTH = 140

/**
 * The platform super-admin role (SPEC §3.3). Seeded to hold EVERY permission row,
 * and the single role that gets the automatic GLOBAL org assignment when a staff
 * account is created with it (`controller/user` → `ensureGlobalAdminAssignment`).
 */
export const ADMINISTRATOR_ROLE = 'administrator'

/**
 * Where a STAFF session belongs on the web app: the customer website is for
 * customers only (plan 022), so /customer* redirects here and the site header's
 * account button points here for a staff session.
 */
export const STAFF_HOME = '/dashboard'

/**
 * Where a signed-in customer lands: the website home (W06). The profile page
 * (/customer, W13) is a destination the user chooses, never a landing page.
 */
export const SITE_HOME = '/'

export const ADDITIONAL_COLUMN_CONFIG: {
  align: 'center' | 'left' | 'right'
  ellipsis: boolean
} = {
  align: 'center',
  ellipsis: true,
}

export const categoryLabels: Record<EventCategory, string> = {
  SERVICE: 'Service',
  SPECIAL: 'Special',
  BIBLE_STUDY: 'Bible study',
  COMMUNITY: 'Community',
  OTHER: 'Other',
}

// Derived from Announcement.published_at (null = draft); not a stored column.
export const ANNOUNCEMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const

export const announcementStatusLabels = {
  [ANNOUNCEMENT_STATUS.DRAFT]: 'Draft',
  [ANNOUNCEMENT_STATUS.PUBLISHED]: 'Published',
}

export const categoryColors: Record<EventCategory, string> = {
  SERVICE: 'blue',
  SPECIAL: 'purple',
  BIBLE_STUDY: 'geekblue',
  COMMUNITY: 'green',
  OTHER: 'default',
}

// F4VO voice profiles: admin review and provider registration are separate states.
export const VOICE_REVIEW_STATES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const
export type VoiceReviewState = (typeof VOICE_REVIEW_STATES)[number]

export const VOICE_REGISTRATION_STATES = [
  'UNREGISTERED',
  'QUEUED',
  'REGISTERING',
  'VERIFICATION_REQUIRED',
  'READY',
  'FAILED',
  'REGISTRATION_UNKNOWN',
  'DISABLED',
] as const
export type VoiceRegistrationState = (typeof VOICE_REGISTRATION_STATES)[number]

export const voiceReviewStateLabels: Record<VoiceReviewState, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const voiceReviewStateColors: Record<VoiceReviewState, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
}

export const voiceRegistrationStateLabels: Record<VoiceRegistrationState, string> = {
  UNREGISTERED: 'Not registered',
  QUEUED: 'Queued',
  REGISTERING: 'Registering',
  VERIFICATION_REQUIRED: 'Verification required',
  READY: 'Ready',
  FAILED: 'Failed',
  REGISTRATION_UNKNOWN: 'Check registration result',
  DISABLED: 'Disabled',
}

export const voiceRegistrationStateColors: Record<VoiceRegistrationState, string> = {
  UNREGISTERED: 'default',
  QUEUED: 'processing',
  REGISTERING: 'processing',
  VERIFICATION_REQUIRED: 'warning',
  READY: 'success',
  FAILED: 'error',
  REGISTRATION_UNKNOWN: 'warning',
  DISABLED: 'default',
}

/** One line of read-only guidance per registration state. */
export const voiceRegistrationStateHelp: Record<VoiceRegistrationState, string> = {
  UNREGISTERED: 'Registration starts automatically after an admin approves the submission.',
  QUEUED: 'Approved. Waiting for voice registration to start.',
  REGISTERING: 'The voice is being registered with the provider.',
  VERIFICATION_REQUIRED:
    'Provider verification is required before this voice can be used. Generation stays blocked; PRAYER support will contact you.',
  READY: 'This voice can be used for prayer audio.',
  FAILED: 'Registration failed. An admin can review the error.',
  REGISTRATION_UNKNOWN:
    'The provider did not confirm the registration in time. PRAYER is checking the result; no action is needed.',
  DISABLED: 'This voice is disabled and cannot be used for new prayer audio.',
}

// ponytail: fixed offline-authorization terms label until legal text/versioning lands (D10).
export const VOICE_CONSENT_TERMS_VERSION = 'offline-authorization-v1'

/** ElevenLabs Instant Voice Cloning recording guidance, shortened (F4VO). */
export const VOICE_RECORDING_TIPS = [
  'Record 1–2 minutes in total. More than 3 minutes adds little and can make the clone worse.',
  'Total length across all files counts, not the number of files.',
  'Recording quality beats length: no reverb, background noise, clicks or artifacts.',
  'MP3 at 128 kbps or higher is enough; a higher bitrate does not help much.',
  'Keep tone, pace and quality consistent across all samples. The AI copies everything, including breathing and noise.',
  'Speak the way the prayers should sound: slow and flat in means slow and flat out.',
  'Aim for volume around −23 to −18 dB RMS, with peaks no higher than −3 dB.',
]

/** Voice timeline: audit action → step on the admin-review track. */
export const VOICE_TIMELINE_REVIEW_STEPS: Record<string, { title: string; color: string }> = {
  'voice.submission.create': { title: 'Draft created', color: 'gray' },
  'voice.consent.create': { title: 'Authorization evidence recorded', color: 'gray' },
  'voice.submission.submit': { title: 'Submitted for review', color: 'blue' },
  'voice.profile.approve': { title: 'Approved', color: 'green' },
  'voice.profile.reject': { title: 'Rejected', color: 'red' },
}

/** Voice timeline: audit action (or action:outcome) → step on the registration track. */
export const VOICE_TIMELINE_REGISTRATION_STEPS: Record<string, { title: string; color: string }> = {
  'voice.profile.approve': { title: 'Queued for registration', color: 'blue' },
  'voice.profile.reclone': { title: 'Registration requested again', color: 'blue' },
  'voice.register:success': { title: 'Registered with ElevenLabs', color: 'green' },
  'voice.register:failure': { title: 'Registration failed', color: 'red' },
  'voice.register.discarded': { title: 'Discarded (disabled during registration)', color: 'gray' },
  'voice.provider.missing': { title: 'Voice missing at ElevenLabs', color: 'red' },
  'voice.profile.disable': { title: 'Disabled', color: 'gray' },
  'voice.consent.revoke': { title: 'Consent revoked', color: 'red' },
}

export const RADIUS_OPTIONS = [
  { value: 5, label: 'Within 5 km' },
  { value: 10, label: 'Within 10 km' },
  { value: 25, label: 'Within 25 km' },
  { value: 50, label: 'Within 50 km' },
] as const

export const DENOMINATION_OPTIONS = [
  { value: 'Lutheran', label: 'Lutheran' },
  { value: 'Lutheran (EELK)', label: 'Lutheran (EELK)' },
  { value: 'Baptist', label: 'Baptist' },
  { value: 'Methodist', label: 'Methodist' },
  { value: 'Catholic', label: 'Catholic' },
  { value: 'Orthodox', label: 'Orthodox' },
  { value: 'Pentecostal', label: 'Pentecostal' },
  { value: 'Anglican', label: 'Anglican' },
  { value: 'Presbyterian', label: 'Presbyterian' },
]

export const WORSHIP_STYLE_OPTIONS = [
  { value: 'Traditional', label: 'Traditional' },
  { value: 'Contemporary', label: 'Contemporary' },
  { value: 'Contemporary Ecumenical', label: 'Contemporary Ecumenical' },
  { value: 'Liturgical', label: 'Liturgical' },
  { value: 'Blended', label: 'Blended' },
  { value: 'Charismatic', label: 'Charismatic' },
]

/**
 * IANA zone names for church setup. `Intl.supportedValuesOf` is native in every
 * runtime this app targets (Node 20+, modern browsers), so no list is vendored.
 */
// SAFETY: supportedValuesOf is standard in modern runtimes (ECMA-402), typed loosely for compatibility
const intlWithSupported = Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] }

export const TIMEZONE_OPTIONS = (intlWithSupported.supportedValuesOf?.('timeZone') ?? []).map(
  (zone) => ({ label: zone, value: zone }),
)

export const LANGUAGE_OPTIONS = [
  { value: 'et', label: 'Eesti (ET)' },
  { value: 'en', label: 'English (EN)' },
  { value: 'sv', label: 'Svenska (SV)' },
  { value: 'fi', label: 'Suomi (FI)' },
] as const

export const denominationOptions = DENOMINATION_OPTIONS
export const radiusOptions = RADIUS_OPTIONS
export const languageOptions = LANGUAGE_OPTIONS

export type RadiusOption = (typeof RADIUS_OPTIONS)[number]
export type DenominationOption = (typeof DENOMINATION_OPTIONS)[number]
export type WorshipStyleOption = (typeof WORSHIP_STYLE_OPTIONS)[number]
export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number]
