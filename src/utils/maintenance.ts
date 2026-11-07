/*
 * Maintenance switch. `NEXT_PUBLIC_IS_MAINTENANCE` must be exactly "true" — the
 * same rule ELEVENLABS_ENABLED follows, so a stray "1" or "TRUE" cannot change
 * the route by accident. A function, not a module constant, so one place owns
 * the rule. Public prefix: the value is also readable in the browser.
 */
export const isMaintenanceEnabled = () => process.env.NEXT_PUBLIC_IS_MAINTENANCE === 'true'
