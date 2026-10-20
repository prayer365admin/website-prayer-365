/**
 * Leave the website for a provider-hosted page (Stripe Checkout). Kept in one
 * place so tests can assert the hand-off without owning `window.location`, and
 * so no component reaches for a global directly.
 */
export const redirectExternal = (url: string) => {
  window.location.assign(url)
}
