import type { App } from 'aws-cdk-lib'
import type { EnvConfig } from './types'
import { catatia } from './environments/catatia'
import { clientExample } from './environments/client-example'

/** Every deployable environment. Add a new client by adding one line here. */
export const registry: Record<string, EnvConfig> = {
  catatia,
  'client-example': clientExample,
}

export const DEFAULT_ENV = 'catatia'

/**
 * Resolves the environment from `-c env=<name>`, then `PRAYER365_ENV`, then the
 * default. An unknown name fails loudly with the list of known environments
 * instead of silently deploying somewhere unexpected.
 */
export const loadEnvConfig = (app: App): EnvConfig => {
  const name =
    (app.node.tryGetContext('env') as string | undefined) ??
    process.env.PRAYER365_ENV ??
    DEFAULT_ENV
  const config = registry[name]
  if (!config) {
    throw new Error(`Unknown env "${name}". Known envs: ${Object.keys(registry).join(', ')}`)
  }
  return config
}
