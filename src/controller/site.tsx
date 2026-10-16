import { GeneralError } from '@/utils/general-error'
import { GET_ME_PROFILE } from '@/providers/mobile'

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
