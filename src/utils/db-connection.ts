import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set — the runtime cannot start without a database connection',
  )
}

// sslmode=require on managed Postgres (self-signed) is treated by the pg
// adapter as verify-full and fails. Strip the param and set ssl explicitly
// to preserve the historical "encrypt, don't pin CA" behavior.
let rawUrl: URL
try {
  rawUrl = new URL(connectionString)
} catch {
  throw new Error(
    'DATABASE_URL is malformed — expected postgres://user:password@host:port/database',
  )
}
rawUrl.searchParams.delete('sslmode')

const isLocal = ['localhost', '127.0.0.1', '::1'].includes(rawUrl.hostname)

// Serverless (Vercel) / Lambda: every function instance builds its OWN pool, so
// the pg default of 10 connections per instance exhausts a 25-connection managed
// Postgres (DigitalOcean, 22 usable + 5 taken by internal agents) after ~2
// instances. 3 is enough for the parallel queries one request runs at a time.
const POOL_MAX = 3

const adapter = new PrismaPg({
  connectionString: rawUrl.toString(),
  max: POOL_MAX,
  // release connections fast so frozen/scale-down instances stop holding slots
  idleTimeoutMillis: 10_000,
  // fail with a clear pool error instead of queueing forever under saturation
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
  // managed Postgres (self-signed): encrypt, don't pin CA.
  // local Postgres has no SSL listener.
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
})

export const db = new PrismaClient({ adapter })
