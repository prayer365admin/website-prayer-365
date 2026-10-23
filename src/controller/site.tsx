import { GeneralError } from '@/utils/general-error'
import { validate } from '@/utils/validate'
import { DonateNeighborSpotlight } from '@/models/donation'
import { MobileChurchListQuerySchema, MobilePrayerListQuerySchema } from '@/models/mobile'
import { GET_ME_PROFILE, LIST_PUBLIC_CHURCHES, LIST_PUBLISHED_PRAYERS } from '@/providers/mobile'

/*
 * Website-only orchestration (SPEC §2.3). Thin; reuses the shared providers.
 */

/**
 * Onboarding progress (WB-15), stored on the account: a step is done once the
 * user filled it (church / language chosen; a main church also counts).
 * Skipping fills nothing, so each new browser asks again until BOTH are filled.
 */
export const getSetupProgress = async ({ userId }: { userId: string }) => {
  const me = await GET_ME_PROFILE({ userId })
  if (!me) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'User not found.',
    })
  }
  const churchStepDone = !!me.churchSetupCompletedAt || !!me.mainChurchId
  const localeStepDone = !!me.localeSetupCompletedAt
  return { churchStepDone, localeStepDone, completed: churchStepDone && localeStepDone }
}

/** How many neighbours are probed for a published prayer before giving up. */
const NEIGHBOR_CANDIDATES = 3

/**
 * W11 spotlight: the nearest other parish that has a published prayer. Distance
 * needs coordinates, so a parish without them gets no card rather than a made-up
 * neighbour; nothing is returned unless a real prayer can be shown.
 */
export const getNeighborSpotlight = async ({
  churchId,
  coordinates,
}: {
  churchId: string
  coordinates: { latitude: number; longitude: number } | null
}): Promise<DonateNeighborSpotlight | null> => {
  if (!coordinates) return null

  const { result } = await LIST_PUBLIC_CHURCHES({
    query: validate(MobileChurchListQuerySchema, {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      limit: NEIGHBOR_CANDIDATES + 1,
    }),
  })
  // The list is distance-sorted; the beneficiary is never its own neighbour.
  const nearby = result
    .filter((row) => row.id !== churchId && Boolean(row.slug))
    .slice(0, NEIGHBOR_CANDIDATES)

  for (const candidate of nearby) {
    const { result: prayers } = await LIST_PUBLISHED_PRAYERS({
      churchId: candidate.id,
      query: validate(MobilePrayerListQuerySchema, { limit: 1 }),
    })
    const prayer = prayers[0]
    if (!prayer) continue

    return {
      churchId: candidate.id,
      slug: candidate.slug ?? candidate.id,
      churchName: candidate.name,
      coverUrl: candidate.coverUrl,
      distanceKm: candidate.distanceKm,
      prayer: {
        id: prayer.id,
        title: prayer.version.title,
        body: prayer.version.body,
        pastorName: prayer.version.pastorName,
        churchName: prayer.churchName,
      },
    }
  }

  return null
}
