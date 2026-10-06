import { compare, hash } from 'bcryptjs'
import { createHash } from 'crypto'

// Deterministic content hash (sha256) used for immutable text snapshots
// (PrayerVersion.text_hash). Unlike bcrypt `hashSecret` (random salt), this is
// reproducible so a worker can verify a version's text matches a requested
// audio generation.
export const hashContent = (content: string) => createHash('sha256').update(content).digest('hex')

// Same sha256 for binary payloads (generated audio bytes) — worker-side checksums.
export const hashBytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

// Hashing password with Bcrypt.js
export async function hashSecret({ secret }: { secret: string }) {
  const hashedPassword = await hash(secret, 12)
  return hashedPassword
}

// Comparing password with Bcrypt.js
export async function verifySecret({
  secret,
  hashedSecret,
}: {
  secret: string
  hashedSecret: string
}) {
  const isValid = await compare(secret, hashedSecret)
  return isValid
}
