'use client'

/*
 * Read-only preview of what a role grants, grouped into the modules the staff
 * screens expose. Labels are derived from the role's own permission rows
 * (`subject` + `actions`) — nothing here is stored per user.
 */

export interface ModuleDefinition {
  name: string
  subjects: string[]
}

export const PERMITTED_MODULES: ModuleDefinition[] = [
  {
    name: 'Church Profiles & Schedule',
    subjects: ['prayer_church'],
  },
  {
    name: 'Daily Prayers & Audio',
    subjects: ['prayer_prayer', 'prayer_prayer_review'],
  },
  {
    name: 'Pastoral Prayer Requests',
    subjects: ['prayer_request', 'prayer_private_request'],
  },
]

export function getModuleAccess(
  subjects: string[],
  permissions: Array<{ subject: string; actions: string }> = [],
): { label: string; color: string } {
  let hasRead = false
  let hasUpdate = false

  for (const p of permissions) {
    if (subjects.includes(p.subject)) {
      const actions = p.actions.split(',').map((a) => a.trim().toLowerCase())
      if (actions.includes('update') || actions.includes('create') || actions.includes('*')) {
        hasUpdate = true
      }
      if (actions.includes('read') || actions.includes('*')) {
        hasRead = true
      }
    }
  }

  if (hasUpdate) {
    return { label: 'View & Approve', color: '#09A97C' }
  }
  if (hasRead) {
    return { label: 'View & Audit', color: '#2F7AD2' }
  }
  return { label: 'Access Denied (Airgapped)', color: '#B91C1C' }
}

/** Derived access summary for the role currently selected in the form. */
export function PermittedModules({
  permissions,
}: {
  permissions?: Array<{ subject: string; actions: string }>
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-[#393E46]">Permitted Modules</span>
      <div className="flex flex-col divide-y divide-[#EEF2F7] rounded-xl border border-[#EEF2F7] bg-white px-4 py-1">
        {PERMITTED_MODULES.map((mod) => {
          const access = getModuleAccess(mod.subjects, permissions)
          return (
            <div key={mod.name} className="flex items-center justify-between py-2">
              <span className="text-sm text-[#334155]">{mod.name}</span>
              <span className="text-sm font-semibold" style={{ color: access.color }}>
                {access.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
