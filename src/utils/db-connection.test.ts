// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ configs: [] as Array<Record<string, unknown>> }))

// Real dotenv would re-supply DATABASE_URL and hide the missing-variable case.
vi.mock('dotenv/config', () => ({}))
vi.mock('@prisma/client', () => ({ PrismaClient: class {} }))
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    constructor(config: Record<string, unknown>) {
      m.configs.push(config)
    }
  },
}))

/** Imports the module fresh with `url` in DATABASE_URL and returns its pool config. */
const loadWith = async (url?: string) => {
  vi.resetModules()
  if (url === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = url

  await import('./db-connection')

  return m.configs.at(-1) as {
    max: number
    idleTimeoutMillis: number
    connectionTimeoutMillis: number
    ssl?: unknown
    connectionString: unknown
  }
}

/*
 * The managed Postgres allows 25 connections (~17 usable) and every serverless
 * instance owns its pool, so the per-instance cap is the knob that decides how
 * many instances fit (plan 026, production P2037 evidence).
 */
describe('db connection pool', () => {
  beforeEach(() => {
    m.configs.length = 0
  })

  it('caps a serverless instance at ONE connection', async () => {
    const config = await loadWith('postgres://u:p@db.example.com:25060/db_prayer_365')

    expect(config.max).toBe(1)
    expect(config.connectionTimeoutMillis).toBe(10_000)
    expect(config.idleTimeoutMillis).toBe(10_000)
    expect(config.ssl).toEqual({ rejectUnauthorized: false })
  })

  it('keeps three connections for a local dev server (single process, no TLS)', async () => {
    const config = await loadWith('postgres://u:p@localhost:5432/x')

    expect(config.max).toBe(3)
    expect(config.ssl).toBeUndefined()
  })

  it('drops the sslmode param the pg adapter would read as verify-full', async () => {
    const config = await loadWith('postgres://u:p@db.example.com:25060/x?sslmode=require')

    expect(String(config.connectionString)).not.toContain('sslmode')
  })

  it('refuses to start without DATABASE_URL', async () => {
    await expect(loadWith()).rejects.toThrow('DATABASE_URL is not set')
  })

  it('refuses to start with a malformed DATABASE_URL', async () => {
    await expect(loadWith('not-a-url')).rejects.toThrow('DATABASE_URL is malformed')
  })
})
