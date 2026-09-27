/*
 * A dedicated error type for external-service adapters that are intentionally
 * not yet wired up. The Phase 10 worker/webhook deliverable will replace these
 * throwing seams with real provider calls. These stubs must NEVER silently
 * return a successful-looking value.
 */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotImplementedError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
