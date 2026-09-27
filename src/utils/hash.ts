import { compare, hash } from 'bcryptjs'

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
