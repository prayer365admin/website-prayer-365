/*
 * Browser record of the onboarding check (WB-15), per user, in localStorage.
 * The account (database) holds which steps are filled; a record here means
 * this browser already asked (and the answer it got). A clean browser has no
 * record, so unfinished setup is shown immediately there.
 */

export type SetupProgress = {
  churchStepDone: boolean
  localeStepDone: boolean
  completed: boolean
}

const key = (userId: string) => `prayer365.setupProgress.${userId}`

export const readSetupProgress = (userId: string): SetupProgress | null => {
  try {
    const raw = window.localStorage.getItem(key(userId))
    return raw ? (JSON.parse(raw) as SetupProgress) : null
  } catch {
    // Private mode / blocked storage: behave like a clean browser.
    return null
  }
}

export const writeSetupProgress = (userId: string, progress: SetupProgress) => {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(progress))
  } catch {
    // Storage unavailable: the server check still applies on the next load.
  }
}

export const SETUP_PATH = '/customer/setup'
export const CUSTOMER_HOME = '/customer'

/** Where a signed-in customer belongs: setup until both steps are filled. */
export const setupTarget = (progress: SetupProgress) =>
  progress.completed ? CUSTOMER_HOME : SETUP_PATH
