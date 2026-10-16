/*
 * Prove the worker Lambdas can reach this environment's database.
 *
 * Runs the EXACT bundle CDK built for Lambda, under plain node, with the real
 * DATABASE_URL loaded from the repository `.env`. This exercises the code path
 * AWS runs; the only difference in production is the network path (outside a VPC
 * for a public database, or through the NAT instance in `network.mode: 'vpc'`).
 *
 * Read-only by construction: the job id does not exist, so the controller reads
 * the row, finds nothing and returns 'skipped'.
 *
 * Usage, from the repository root:
 *   cd infra && bunx cdk synth -c env=<env> --quiet
 *   cd .. && node infra/scripts/lambda-db-proof.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const cdkOut = path.resolve(__dirname, '..', 'cdk.out')

/** The two bundles are identified by a marker inside them, no hash guessing. */
const findAsset = (marker) => {
  if (!fs.existsSync(cdkOut)) {
    throw new Error(`no ${path.relative(process.cwd(), cdkOut)} yet — run "bunx cdk synth -c env=<env>" first`)
  }
  for (const entry of fs.readdirSync(cdkOut)) {
    if (!entry.startsWith('asset.')) continue
    const candidate = path.join(cdkOut, entry, 'index.js')
    if (fs.existsSync(candidate) && fs.readFileSync(candidate, 'utf8').includes(marker)) {
      return path.join(cdkOut, entry)
    }
  }
  throw new Error(`no Lambda bundle containing "${marker}" found in ${cdkOut}`)
}

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — run this from the repository root so .env is loaded')
  }

  const consumer = require(path.join(findAsset('job_processed'), 'index.js'))
  const dispatcher = require(path.join(findAsset('job_dispatch_tick'), 'index.js'))

  console.log('database host:', new URL(process.env.DATABASE_URL).host)

  const consumerResult = await consumer.handler({
    Records: [
      {
        messageId: 'proof-1',
        body: JSON.stringify({
          kind: 'prayer.publish',
          jobId: '00000000-0000-7000-8000-000000000000',
        }),
      },
    ],
  })
  console.log('consumer.handler ->', JSON.stringify(consumerResult))

  if (consumerResult.batchItemFailures.length > 0) {
    throw new Error('the consumer reported a batch item failure — the database rejected the work')
  }

  /*
   * The dispatcher run is optional because it CLAIMS due rows and then sends to
   * SQS: only run it when a real queue URL is exported, otherwise it would claim
   * work it cannot deliver.
   */
  if (process.env.JOBS_QUEUE_URL) {
    const dispatcherResult = await dispatcher.handler()
    console.log('dispatcher.handler ->', JSON.stringify(dispatcherResult))
  } else {
    console.log('dispatcher run skipped (export JOBS_QUEUE_URL to include it)')
  }

  console.log('PROOF OK: the Lambda artifacts reached the database and ran')
}

main().catch((error) => {
  console.error('PROOF FAILED:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
