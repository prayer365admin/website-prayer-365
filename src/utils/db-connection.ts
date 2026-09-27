import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// sslmode=require on managed Postgres (self-signed) is treated by the pg
// adapter as verify-full and fails. Strip the param and set ssl explicitly
// to preserve the historical "encrypt, don't pin CA" behavior.
const rawUrl = new URL(process.env.DATABASE_URL!)
rawUrl.searchParams.delete('sslmode')

const adapter = new PrismaPg({
  connectionString: rawUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

export const db = new PrismaClient({ adapter })
