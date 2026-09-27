/*
 * PRAYER role -> permission grant matrix (data only, no DB side-effects).
 * Shared by seeds/permission.ts (row catalogue) and seeds/role.ts (wiring).
 *
 * Roles and grant philosophy per SPEC §3.3 / §3.4:
 * - prayer_global_admin: broad platform powers, NO default private-request access.
 * - country/diocese/deanery: descendant AGGREGATE reporting only.
 * - prayer_church_admin: church overview/profile/content/publication + local
 *   donation/analytics summaries.
 * - prayer_pastor: own voice submission only (OWN scope), no self-approval.
 * - prayer_request_reader / prayer_private_request_reader: church-scoped reads.
 *
 * `actions` is a comma-separated CRUD list; each expands to its own
 * (subject, actions, scope) permission row.
 */

export interface PrayerGrant {
  subject: string
  actions: string // comma-separated CRUD list
  scope: 'ANY' | 'OWN'
}

export interface PrayerRole {
  name: string
  grants: PrayerGrant[]
}

export const PRAYER_ROLES: PrayerRole[] = [
  {
    name: 'prayer_global_admin',
    grants: [
      { subject: 'prayer_church', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_church_lifecycle', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_pastor', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_prayer', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_prayer_review', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_prayer_publication', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_voice_generation', actions: 'create', scope: 'ANY' },
      { subject: 'prayer_voice_profile', actions: 'read,update', scope: 'ANY' },
      { subject: 'prayer_voice_submission', actions: 'read,create,update', scope: 'OWN' },
      { subject: 'prayer_service_time', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_event', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_announcement', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_donation', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_analytics', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_attendance', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_platform_statistics', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_hierarchy', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_country', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_language', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_administrator', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_role', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_permission', actions: 'read', scope: 'ANY' },
      { subject: 'prayer_role_assignment', actions: 'read,create,delete', scope: 'ANY' },
      { subject: 'prayer_notification_rule', actions: 'read,update', scope: 'ANY' },
      { subject: 'prayer_media', actions: 'create,read', scope: 'ANY' },
      { subject: 'prayer_request', actions: 'read', scope: 'ANY' },
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
      { subject: 'prayer_prayer', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_prayer_publication', actions: 'update', scope: 'ANY' },
      { subject: 'prayer_voice_generation', actions: 'create', scope: 'ANY' },
      { subject: 'prayer_service_time', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_event', actions: 'read,create,update', scope: 'ANY' },
      { subject: 'prayer_announcement', actions: 'read,create,update', scope: 'ANY' },
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
    grants: [{ subject: 'prayer_request', actions: 'read', scope: 'ANY' }],
  },
  {
    name: 'prayer_private_request_reader',
    grants: [{ subject: 'prayer_private_request', actions: 'read', scope: 'ANY' }],
  },
]

/** Expand the matrix into distinct (subject, actions, scope) rows. */
export const expandPrayerGrants = (): {
  subject: string
  actions: string
  scope: 'ANY' | 'OWN'
}[] => {
  const seen = new Set<string>()
  const rows: { subject: string; actions: string; scope: 'ANY' | 'OWN' }[] = []
  for (const role of PRAYER_ROLES) {
    for (const g of role.grants) {
      for (const action of g.actions.split(',')) {
        const key = `${g.subject}|${action}|${g.scope}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push({ subject: g.subject, actions: action, scope: g.scope })
      }
    }
  }
  return rows
}
