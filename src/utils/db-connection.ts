import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { readPoolSettings } from './db-resilience'

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

// Pool size per serverless instance comes from DB_POOL_MAX, because the budget
// differs per deployment (see db-resilience.ts):
//   prod  (RDS, max_connections 79) → DB_POOL_MAX=unlimited
//   staging (DigitalOcean, 25)      → unset, i.e. 1 (the old fixed value)
// A dev server is a single process, so it keeps 3 unless the env says otherwise.
const poolSettings = isLocal
  ? { max: 3, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 }
  : readPoolSettings()

const adapter = new PrismaPg({
  connectionString: rawUrl.toString(),
  ...poolSettings,
  allowExitOnIdle: true,
  // managed Postgres (self-signed): encrypt, don't pin CA.
  // local Postgres has no SSL listener.
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
})

export const db = new PrismaClient({ adapter })
