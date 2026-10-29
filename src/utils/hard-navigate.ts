/**
 * Full-document navigation after a session change (sign-in). `router.push` is
 * wrong there: the client router cache keeps whatever it collected BEFORE the
 * session existed, so a protected page the guest visited stays cached as its
 * server redirect to `/login`, and the first click after signing in replays that
 * redirect (the user stays stuck on the profile page until a manual reload).
 *
 * `replace` (not `assign`): the sign-in page leaves the history, so Back cannot
 * bounce through `/login`, whose guest guard sends a signed-in customer to `/`.
 */
export const hardNavigate = (url: string) => {
  window.location.replace(url)
}
