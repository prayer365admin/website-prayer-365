import { GeneralError } from '@/utils/general-error'
import { GET_ANALYTICS, GET_ATTENDANCE_SUMMARY, GET_REGION_SUMMARY } from '@/providers/analytics'
import { AnalyticsMetrics, AttendanceSummary, RegionSummary } from '@/models/analytics'

/*
 * Analytics controller (Tasks 31-32). Church-scoped reads re-verify the target
 * church is inside the resolved grant (404 hides cross-church existence).
 * Regional summary uses the `churchIds` set that requiredScope resolved as the
 * descendant church set of the region — aggregation only, never private
 * requests, never raw donor rows.
 */

const ensureChurchInScope = (churchId: string, churchIds: Set<string>) => {
  if (!churchIds.has(churchId)) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
}

export const getAnalytics = async ({
  churchId,
  churchIds,
  from,
  to,
}: {
  churchId: string
  churchIds: Set<string>
  from?: Date
  to?: Date
}): Promise<AnalyticsMetrics> => {
  ensureChurchInScope(churchId, churchIds)
  return GET_ANALYTICS({ churchIds, from: from ?? null, to: to ?? null })
}

export const getAttendanceSummary = async ({
  churchId,
  churchIds,
  from,
  to,
}: {
  churchId: string
  churchIds: Set<string>
  from?: Date
  to?: Date
}): Promise<AttendanceSummary> => {
  ensureChurchInScope(churchId, churchIds)
  return GET_ATTENDANCE_SUMMARY({ churchIds, from: from ?? null, to: to ?? null })
}

export const getRegionSummary = async ({
  regionId,
  churchIds,
  from,
  to,
}: {
  regionId: string
  churchIds: Set<string>
  from?: Date
  to?: Date
}): Promise<RegionSummary> => {
  return GET_REGION_SUMMARY({ regionId, churchIds, from: from ?? null, to: to ?? null })
}
