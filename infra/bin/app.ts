#!/usr/bin/env node
import 'source-map-support/register'
import { App } from 'aws-cdk-lib'
import { loadEnvConfig } from '../config'
import { DataStack } from '../lib/data-stack'
import { StorageStack } from '../lib/storage-stack'
import { WorkerStack } from '../lib/worker-stack'

/*
 * One CDK app, three independently deployable stacks. Stacks share nothing but
 * SSM parameters, so a single component can be deployed with
 * `bunx cdk deploy prayer365-<env>-workers -c env=<env> --exclusively`.
 *
 *   bun run deploy:storage | deploy:data | deploy:workers | deploy:all
 *   PRAYER365_ENV=<env> bun run deploy:workers
 */

const app = new App()
const config = loadEnvConfig(app)
const env = { account: config.account, region: config.region }
const prefix = `prayer365-${config.name}`

new StorageStack(app, `${prefix}-storage`, { env, config })
const data = new DataStack(app, `${prefix}-data`, { env, config })
// The VPC is handed over only when the environment runs in `network.mode: 'vpc'` AND the
// workers are meant to sit in it; `lambdaInVpc: false` keeps them outside, where they reach
// the internet directly and talk to a PUBLIC database endpoint over TLS (the Vercel shape).
const workersVpc =
  config.network.mode === 'vpc' && config.network.lambdaInVpc !== false ? data.vpc : undefined
new WorkerStack(app, `${prefix}-workers`, { env, config, vpc: workersVpc })
