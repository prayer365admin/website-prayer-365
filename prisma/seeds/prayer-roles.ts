/*
 * PRAYER permission catalogue + role -> grant matrix (data only, no DB writes).
 * Shared by seeds/permission.ts (row catalogue) and seeds/role-permission.ts
 * (role wiring) and seeds/user.ts (role binding).
 *
 * Model (confirmed): single-role RBAC for identity/staff + org-hierarchy
 * scoping for church/region tenancy (hybrid, option 1).
 * - User -> 1 Role via User.role_id.
 * - Role = bundle of permissions (seeded "prayer_*" or admin-created "USER").
 * - Permission = subject (entity/title) + actions READ/CREATE/UPDATE/DELETE
 *   + scope OWN/ANY. Global admin edits per-role; affects all bound users.
 * - role_assignments retained ONLY as the church/region tenancy layer for the
 *   74 scoped content routes (requiredScope), not for identity binding.
 *
 * `actions` is a comma-separated CRUD list; each expands to its own
 * (subject, actions, scope) permission row.
 */

// ---------------------------------------------------------------------------
// FULL permission catalogue — every feasible (subject, action, scope) row so
// the Role Access Control editor is complete and roles are freely reconfigurable.
// ---------------------------------------------------------------------------

export interface PrayerGrant {
  subject: string
  actions: string // comma-separated CRUD list
  scope: 'ANY' | 'OWN'
}

/** Entries where multiple actions + ANY scope make sense. */
const ANY_CRUD = (subject: string, actions = 'read,create,update,delete'): PrayerGrant[] => [
  { subject, actions, scope: 'ANY' },
]

/**
 * Complete catalogue of every permission row the system can grant.
 * A role's grant matrix below must reference subjects present here.
 */
export const PRAYER_CATALOGUE: PrayerGrant[] = [
  // Church & organization
  // `delete` here means PURGE of a pending church with no dependent rows
  // (plan 020 / SPEC §4); it never cascades over content or financial records.
  ...ANY_CRUD('prayer_church'),
  { subject: 'prayer_church_lifecycle', actions: 'read,update', scope: 'ANY' },
  ...ANY_CRUD('prayer_pastor'),
  ...ANY_CRUD('prayer_service_time', 'read,create,update,delete'),
  { subject: 'prayer_org_node', actions: 'read,create,update', scope: 'ANY' },

  // Content
  ...ANY_CRUD('prayer_prayer', 'read,create,update'),
  { subject: 'prayer_prayer_review', actions: 'update', scope: 'ANY' },
  { subject: 'prayer_prayer_publication', actions: 'update', scope: 'ANY' },
  ...ANY_CRUD('prayer_event', 'read,create,update,delete'),
  ...ANY_CRUD('prayer_announcement', 'read,create,update,delete'),
  { subject: 'prayer_announcement_publication', actions: 'update', scope: 'ANY' },

  // Voice / audio / media
  { subject: 'prayer_voice_generation', actions: 'create', scope: 'ANY' },
  { subject: 'prayer_voice_submission', actions: 'read,create,update', scope: 'OWN' },
  { subject: 'prayer_voice_submission', actions: 'read', scope: 'ANY' },
  { subject: 'prayer_voice_profile', actions: 'read,update', scope: 'ANY' },
  { subject: 'prayer_consent', actions: 'read,create', scope: 'ANY' },
  ...ANY_CRUD('prayer_prayer_audio', 'read,create,update'),
  ...ANY_CRUD('prayer_media', 'create,read'),

  // Requests (sensitive)
  { subject: 'prayer_request', actions: 'read', scope: 'ANY' },
  { subject: 'prayer_private_request', actions: 'read', scope: 'ANY' },

  // Financial / analytics
  { subject: 'prayer_donation', actions: 'read', scope: 'ANY' },
  { subject: 'prayer_analytics', actions: 'read', scope: 'ANY' },
  { subject: 'prayer_attendance', actions: 'read', scope: 'ANY' },
  { subject: 'prayer_platform_statistics', actions: 'read', scope: 'ANY' },

  // Central registry
  ...ANY_CRUD('prayer_hierarchy', 'read,create,update'),
  ...ANY_CRUD('prayer_country', 'read,create,update'),
  ...ANY_CRUD('prayer_language', 'read,create,update'),

  // Staff / roles / permissions
  ...ANY_CRUD('prayer_administrator', 'read,create,update'),
  ...ANY_CRUD('prayer_role', 'read,create,update'),
  ...ANY_CRUD('prayer_permission', 'read,update'),
  ...ANY_CRUD('prayer_role_assignment', 'read,create,delete'),
  { subject: 'prayer_notification_rule', actions: 'read,update', scope: 'ANY' },
  { subject: 'prayer_customer', actions: 'read', scope: 'ANY' },
]

// ---------------------------------------------------------------------------
// Role -> grant matrix. Zero here means "admin-created role picks its own".
// ---------------------------------------------------------------------------

export interface PrayerRole {
  name: string
  grants: PrayerGrant[]
}

export const PRAYER_ROLES: PrayerRole[] = [
  {
    name: 'prayer_global_admin',
    grants: [
      { subject: 'prayer_church', actions: 'read,create,update,delete', scope: 'ANY' },
      { subject: 'prayer_church_lifecycle', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_pastor', actions: 'read,create,update,delete', scope: 'ANY' },
      { subject: 'prayer_prayer', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_prayer_review', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_prayer_publication', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_voice_generation', actions: 'create', scope: 'ANY' },
      { subject: 'prayer_voice_profile', actions: 'read,update', scope: 'ANY' },
      { subject: 'prayer_voice_submission', actions: 'read,create,update', scope: 'OWN' },
      { subject: 'prayer_service_time', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_event', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_announcement', actions: 'read,create,update,delete', scope: 'ANY' },
      { subject: 'prayer_announcement_publication', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_donation', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_analytics', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_attendance', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_platform_statistics', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_hierarchy', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_country', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_language', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_administrator', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_role', actions: 'read,update', scope: 'ANY' },
      { subject: 'prayer_permission', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_role_assignment', actions: 'read,create,delete', scope: 'ANY' },
      { subject: 'prayer_notification_rule', actions: 'read,update', scope: 'ANY' },
      { subject: 'prayer_media', actions: 'create,read', scope: 'ANY' },
      { subject: 'prayer_request', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_customer', actions: 'read', scope: 'ANY' },
    ],
  },
  {
    name: 'prayer_country_admin',
    grants: [
      { subject: 'prayer_analytics', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_attendance', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_donation', actions: 'read', scope: 'ANY' },
    ],
  },
  {
    name: 'prayer_diocese_admin',
    grants: [
      { subject: 'prayer_analytics', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_attendance', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_donation', actions: 'read', scope: 'ANY' },
    ],
  },
  {
    name: 'prayer_deanery_admin',
    grants: [
      { subject: 'prayer_analytics', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_attendance', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_donation', actions: 'read', scope: 'ANY' },
    ],
  },
  {
    name: 'prayer_church_admin',
    grants: [
      { subject: 'prayer_church', actions: 'read,update', scope: 'ANY' },
      { subject: 'prayer_pastor', actions: 'read,update', scope: 'ANY' },
      { subject: 'prayer_prayer', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_prayer_publication', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_voice_generation', actions: 'create', scope: 'ANY' },
      { subject: 'prayer_service_time', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_event', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_announcement', actions: 'read,create,update,delete', scope: 'ANY' },
      { subject: 'prayer_announcement_publication', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_donation', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_analytics', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_attendance', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_media', actions: 'create,read', scope: 'ANY' },
    ],
  },
  {
    name: 'prayer_pastor',
    grants: [{ subject: 'prayer_voice_submission', actions: 'read,create,update', scope: 'OWN' }],
  },
  {
    name: 'prayer_request_reader',
    // Church read is the entry point: the church route guard, My Churches and
    // the overview all need it to reach the Requests page.
    grants: [
      { subject: 'prayer_church', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_request', actions: 'read', scope: 'ANY' },
    ],
  },
  {
    name: 'prayer_private_request_reader',
    // Includes church read (entry point) and base request read so one church
    // assignment is enough (F7RQ R3).
    grants: [
      { subject: 'prayer_church', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_request', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_private_request', actions: 'read', scope: 'ANY' },
    ],
  },
  {
    // END-USER (mobile customer) — no admin grants by default.
    name: 'prayer_user',
    grants: [],
  },
]

/** Expand a grant list into distinct (subject, actions, scope) rows. */
const expandGrants = (
  grants: PrayerGrant[],
): { subject: string; actions: string; scope: 'ANY' | 'OWN' }[] => {
  const seen = new Set<string>()
  const rows: { subject: string; actions: string; scope: 'ANY' | 'OWN' }[] = []
  for (const g of grants) {
    for (const action of g.actions.split(',')) {
      const key = `${g.subject}|${action}|${g.scope}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ subject: g.subject, actions: action, scope: g.scope })
    }
  }
  return rows
}

/** Full catalogue rows (seeded to DB in seeds/permission.ts). */
export const expandPrayerCatalogue = (): {
  subject: string
  actions: string
  scope: 'ANY' | 'OWN'
}[] => expandGrants(PRAYER_CATALOGUE)

/** Role matrix rows kept for wiring a specific role's grants in role-permission.ts. */
export const roleGrantRows = (
  role: PrayerRole,
): { subject: string; actions: string; scope: 'ANY' | 'OWN' }[] => expandGrants(role.grants)
