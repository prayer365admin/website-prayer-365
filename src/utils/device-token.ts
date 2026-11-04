import crypto from 'node:crypto'
import { GeneralError } from '@/utils/general-error'

/*
 * Device tokens are personal credentials: store ciphertext, look up by hash.
 * DEVICE_TOKEN_KEY is a base64 32-byte key (AES-256-GCM) shared by the web route
 * (writes) and the worker (send/decrypt).
 */

const KEY_ENV = 'DEVICE_TOKEN_KEY'

const key = (): Buffer => {
  const raw = process.env[KEY_ENV]
  if (!raw) {
    throw new GeneralError({
      code: 500,
      error: 'CONFIG_ERROR',
      error_code: 'DEVICE_TOKEN_KEY_MISSING',
      details: 'Device token key is not configured.',
    })
  }
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new GeneralError({
      code: 500,
      error: 'CONFIG_ERROR',
      error_code: 'DEVICE_TOKEN_KEY_INVALID',
      details: 'Device token key must be 32 bytes, base64 encoded.',
    })
  }
  return buf
}

export const hashDeviceToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex')

export const encryptDeviceToken = (token: string): string => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
}

export const decryptDeviceToken = (payload: string): string => {
  const buf = Buffer.from(payload, 'base64')
  if (buf.length < 29) throw new Error('Invalid device token payload')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const body = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}
