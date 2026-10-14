import { describe, expect, it } from 'vitest'
import { App } from 'aws-cdk-lib'
import { DEFAULT_ENV, loadEnvConfig, registry } from '../config'
import { catatia } from '../config/environments/catatia'
import { clientExample } from '../config/environments/client-example'

describe('loadEnvConfig', () => {
  it('resolves the environment named by -c env', () => {
    const app = new App({ context: { env: 'client-example' } })
    expect(loadEnvConfig(app)).toBe(clientExample)
  })

  it('falls back to PRAYER365_ENV, then the default', () => {
    const previous = process.env.PRAYER365_ENV
    try {
      process.env.PRAYER365_ENV = 'catatia'
      expect(loadEnvConfig(new App())).toBe(catatia)

      delete process.env.PRAYER365_ENV
      expect(loadEnvConfig(new App())).toBe(registry[DEFAULT_ENV])
    } finally {
      if (previous === undefined) delete process.env.PRAYER365_ENV
      else process.env.PRAYER365_ENV = previous
    }
  })

  it('fails loudly on an unknown environment and lists the known ones', () => {
    const app = new App({ context: { env: 'nope' } })
    expect(() => loadEnvConfig(app)).toThrowError(/Unknown env "nope".*catatia/)
  })
})

describe('environment configs', () => {
  it('catatia is the throw-away environment using the shared bucket and an external DB', () => {
    expect(catatia.account).toBe('430118850592')
    expect(catatia.removalPolicy).toBe('destroy')
    expect(catatia.storage).toEqual({ mode: 'existing', bucketName: 'bucket-catatia' })
    expect(catatia.database.mode).toBe('external')
  })

  it('every env keeps the outbox lease at or above the consumer timeout', () => {
    for (const config of Object.values(registry)) {
      expect(config.workers.leaseSeconds).toBeGreaterThanOrEqual(
        config.workers.consumerTimeoutSeconds,
      )
    }
  })
})
