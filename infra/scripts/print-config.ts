/*
 * Print one environment's resolved config as JSON, for the interactive deploy
 * script (infra/scripts/deploy.sh) and for any other tooling.
 *
 *   bunx tsx infra/scripts/print-config.ts catatia
 *   bunx tsx infra/scripts/print-config.ts --list
 *
 * Imports only the plain-data config modules, so it needs no AWS credentials and
 * no CDK runtime (the `App` import in config/index.ts is type-only).
 */
import { registry } from '../config'

const name = process.argv[2]

if (name === '--list' || name === undefined) {
  for (const key of Object.keys(registry)) {
    console.log(key)
  }
  process.exit(0)
}

// Fail loudly on an unknown name: falling back to a default would make the
// deploy script compare the wrong account and print the wrong config.
const config = registry[name]
if (!config) {
  console.error(
    `Unknown env "${name}". Registered: ${Object.keys(registry).join(', ')}. ` +
      'Add it to infra/config/index.ts first.',
  )
  process.exit(1)
}

console.log(JSON.stringify(config))
