import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decryptDeviceToken, encryptDeviceToken, hashDeviceToken } from '@/utils/device-token'

const KEY = crypto.randomBytes(32).toString('base64')

describe('device token crypto', () => {
  beforeEach(() => {
    process.env.DEVICE_TOKEN_KEY = KEY
  })
  afterEach(() => {
    delete process.env.DEVICE_TOKEN_KEY
  })

  it('round-trips a token', () => {
    const token = 'fcm-token-1234567890'
    expect(decryptDeviceToken(encryptDeviceToken(token))).toBe(token)
  })

  it('uses a fresh IV per encryption', () => {
    const a = encryptDeviceToken('same-token')
    const b = encryptDeviceToken('same-token')
    expect(a).not.toBe(b)
  })

  it('hashes deterministically without keeping the plaintext', () => {
    const hash = hashDeviceToken('fcm-token-1234567890')
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain('fcm-token')
  })

  it('rejects a tampered payload', () => {
    const payload = Buffer.from(encryptDeviceToken('fcm-token-1234567890'), 'base64')
    payload[payload.length - 1] ^= 0xff
    expect(() => decryptDeviceToken(payload.toString('base64'))).toThrow()
  })

  it('fails loudly without a valid key', () => {
    delete process.env.DEVICE_TOKEN_KEY
    try {
      encryptDeviceToken('x')
      throw new Error('expected a missing-key failure')
    } catch (err) {
      expect(err).toMatchObject({ error_code: 'DEVICE_TOKEN_KEY_MISSING' })
    }
    process.env.DEVICE_TOKEN_KEY = 'short'
    try {
      encryptDeviceToken('x')
      throw new Error('expected an invalid-key failure')
    } catch (err) {
      expect(err).toMatchObject({ error_code: 'DEVICE_TOKEN_KEY_INVALID' })
    }
  })
})
