import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// sslmode=require on managed Postgres (self-signed) is treated by the pg
// adapter as verify-full and fails. Strip the param and set ssl explicitly
// to preserve the historical "encrypt, don't pin CA" behavior.
let rawUrl: URL
try {
  rawUrl = new URL(process.env.DATABASE_URL || 'postgres://localhost')
} catch {
  rawUrl = new URL('postgres://localhost')
}
rawUrl.searchParams.delete('sslmode')

const isLocal = ['localhost', '127.0.0.1', '::1'].includes(rawUrl.hostname)

const adapter = new PrismaPg({
  connectionString: rawUrl.toString(),
  // managed Postgres (self-signed): encrypt, don't pin CA.
  // local Postgres has no SSL listener.
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
})

export const db = new PrismaClient({ adapter })
