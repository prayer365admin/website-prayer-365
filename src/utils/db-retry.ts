/**
 * Connection-ceiling helpers.
 *
 * The managed Postgres allows 25 connections, ~17 of them usable by the app, and
 * every serverless instance holds its own pool. When every slot is taken, the
 * server refuses the next non-superuser connection and Prisma reports code
 * P2037 / `TooManyConnections` — a momentary capacity blip, not a data fault.
 */

/** True for the "no connection slot left" signature, and nothing else. */
export const isConnectionLimitError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code
  const text = error instanceof Error ? `${error.name}: ${error.message}` : ''
  return code === 'P2037' || /TooManyConnections|Too many database connections/i.test(text)
}

/**
 * One retry for a refused connection: a second attempt is far cheaper than
 * showing the error page. Anything that is not a connection-limit error is
 * rethrown immediately, and the last attempt always rethrows, so a real fault
 * (database down, bad query, bad config) is never hidden.
 */
export const withConnectionRetry = async <T>(
  work: () => Promise<T>,
  { attempts = 2, delayMs = 250 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> => {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      if (!isConnectionLimitError(error) || attempt === attempts) break
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
