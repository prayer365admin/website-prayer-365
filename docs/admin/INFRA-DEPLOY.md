# PRAYER 365 — AWS Infrastructure Deploy & Handover

| Field      | Value                                                              |
| ---------- | ------------------------------------------------------------------ |
| Document   | INFRA-DEPLOY — infrastructure as code, deployment and manual steps |
| Version    | 1.0                                                                |
| Date       | 14 October 2026                                                    |
| Author     | Catatia engineering                                                |
| Approver   | [TBD]                                                              |
| Applies to | `prayer-365-dashboard` / `infra/` (AWS CDK v2, TypeScript)         |

---

## 1. What this covers

The AWS side of PRAYER 365 is defined in code in the `infra/` folder of this repository.

| Component | Stack                     | What it creates                                                                                                                                                                                                                                          |
| --------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage   | `prayer365-<env>-storage` | Media bucket (only when `storage.mode: 'create'`); otherwise it only publishes the existing bucket name                                                                                                                                                  |
| Data      | `prayer365-<env>-data`    | SQS job queue + dead-letter queue, five Secrets Manager containers, the SES domain identity, the app IAM user + key pair for Vercel (client environments), and (when `database.mode: 'create'`) a VPC with a NAT instance and an RDS PostgreSQL instance |
| Workers   | `prayer365-<env>-workers` | Dispatcher Lambda, consumer Lambda, SQS event source, dispatch schedule, log groups and three alarms                                                                                                                                                     |

The web application and its API stay on **Vercel**. The two runtimes share only the database:
Vercel writes an `outbox_jobs` row in the same transaction as the business change, and the Lambda
workers read and update those rows. They never call each other.

```mermaid
flowchart LR
    V["Vercel: dashboard + API"] -->|"INSERT outbox_jobs"| DB[(PostgreSQL)]
    DISP["dispatcher Lambda (every minute)"] -->|"CLAIM + send reference"| Q[(SQS jobs)]
    Q --> CONS["consumer Lambda"]
    CONS -->|"processXJob"| DB
    CONS --> S3[(S3 media)]
    CONS --> EXT[ElevenLabs / Stripe / SMTP]
    CONS -. 5 receives .-> DLQ[(SQS jobs DLQ)]
```

---

## 2. Environments

One config file per deployment target: `infra/config/environments/<name>.ts`, kept in the registry in
`infra/config/index.ts`. Select it with `-c env=<name>` or `PRAYER365_ENV`.

| Environment      | Account                               | Database                                                                                     | Storage                                  | Network                                           | Purpose                                                                                |
| ---------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `catatia`        | 430118850592 (shared company account) | External — DigitalOcean managed PostgreSQL                                                   | Reuses `bucket-catatia`                  | `public` (Lambdas outside a VPC)                  | Current target, and the throw-away account for deploy tests (`removalPolicy: destroy`) |
| `client-example` | 000000000000 (placeholder)            | RDS PostgreSQL 16, `db.t4g.micro`, 20 GB, single-AZ (free tier)                              | Dedicated `prayer365-<env>-media` bucket | `vpc` + fixed egress IP                           | Template to copy for a client account                                                  |
| `prayer-365`     | 007091975568 (client-owned)           | RDS PostgreSQL 16, `db.t4g.micro`, 20 GB, single-AZ, **public** (`publiclyAccessible: true`) | Own `prayer365-prayer-365-media` bucket  | `vpc` — Lambdas in private subnets + NAT instance | Client production environment (deployed 23 October 2026)                               |

### Public vs private database

`database.publiclyAccessible` decides two things at once: the subnet the instance is created in
(PUBLIC → public subnets, PRIVATE → private subnets) and its security group rule.

| Value   | Subnet  | Security group              | Who can connect                                                                                                                                                                             |
| ------- | ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `true`  | public  | 5432 open to `0.0.0.0/0`    | Anything on the internet, including Vercel. TLS (`sslmode=require`) plus the RDS-generated password are the only guard — a deliberate temporary posture, like the public media bucket (D13) |
| `false` | private | 5432 from the VPC CIDR only | The worker Lambdas in the same VPC. A web app on Vercel **cannot** connect                                                                                                                  |

The stack used to hardcode `false`; a client whose web app runs on Vercel therefore needs `true`, because
Vercel has no fixed egress IPs to allow-list. Whichever value is chosen, the data stack now emits an
explicit security-group rule — the construct's default group has **no** inbound rules, so a private
instance was previously reachable by nothing at all.

### Email (SES)

`email` names the sending domain for the environment. `mode: 'existing'` adopts a domain already verified
in that account's SES (`catatia.com`); `mode: 'create'` creates the identity and the stack prints
`SesDomain`, `SesMailFromDomain` and the three `SesDkimToken*` pairs that the domain owner has to publish.
The data stack also writes `/prayer365/<env>/ses-domain`. Records, verification commands and the SES
sandbox limitation are in **docs/admin/SES-DNS.md**; `deploy.sh --check` reports whether the identity is
verified.

The app sends through SES with `MAIL_PROVIDER=ses` (plus `MAIL_FROM` and `SES_REGION`); Mailtrap and
Mailgun stay selectable through the same variable, and an unknown value fails with
`MAIL_PROVIDER_UNSUPPORTED` instead of crashing at the first send. Credentials come from the app IAM user
the data stack creates for client environments (`prayer365-<env>-app`, key pair in
`/prayer365/<env>/app-credentials`, S3 scoped to the media bucket and SES scoped to the identity). catatia
keeps using the shared account's existing user.

The **worker component sends mail too** (`mail.send` jobs, e.g. verify-email and forgot-password):

| Item                          | Where it comes from                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAIL_PROVIDER`, `SES_REGION` | `email.provider` and `region` in the environment config, injected into both Lambdas                                                                                                                                                                                                                                                                      |
| Permission to send            | `ses:SendEmail` / `ses:SendRawEmail` on the verified identity **and** on `configuration-set/*`, granted to the **consumer role** when `email.provider: 'ses'`. The account's default configuration set is applied implicitly, so an identity-only grant fails with `AccessDenied ... configuration-set/...` — and nodemailer reports that only as `ESES` |
| Credentials                   | none for SES (the role is the credential); SMTP providers read `mail-credentials`                                                                                                                                                                                                                                                                        |

The `mail-credentials` secret holds **credentials only**. A `MAIL_PROVIDER` key inside it is ignored, so
a stale secret version cannot override the deployed provider.

### Database location is configuration, not code

The workers do not care where PostgreSQL lives. Both runtimes read the `DATABASE_URL` secret and use
the same Prisma adapter, so **changing the database is a secret value change**, not a code or stack
change. What does change is the _network placement_ of the Lambda, which is set by `network.mode`:

| `network.mode` | Lambda placement                               | Works with                                                                                                          | Extra cost                              |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `public`       | Outside any VPC (default)                      | Any database with a publicly reachable endpoint: DigitalOcean, Neon, Supabase, RDS with a public endpoint, a tunnel | none                                    |
| `vpc`          | VPC private subnets, egress via a NAT instance | Private RDS; any database that only accepts allow-listed source IPs                                                 | ~$4/month (NAT instance) + ~$3.6 (IPv4) |

With `network: { mode: 'vpc', natInstanceType: 't4g.nano', staticEgressIp: true }` the NAT instance
gets a fixed Elastic IP, printed as the `NatEgressIp` stack output and stored at
`/prayer365/<env>/nat-egress-ip`. Add that IP to the database firewall when the provider requires an
allow-list (DigitalOcean "Trusted Sources", RDS security groups, Neon/Supabase IP allow lists).

`database.mode: 'create'` requires `network.mode: 'vpc'`; the data stack refuses to synthesize a
private RDS instance that the Lambdas could not reach. DigitalOcean's endpoint is public, so
`catatia` uses `public` today at zero extra cost — switch it to the `vpc` block above if the
DigitalOcean cluster ever enables Trusted Sources.

Cost notes: the RDS configuration fits the AWS free tier for the first 12 months; afterwards budget
roughly USD 13–15 per month. The NAT instance (`t4g.nano`, used only for client environments) costs
about USD 4 per month plus its public IPv4 address. A NAT _gateway_ would cost about USD 32 per
month and is deliberately not used.

`workers.enabled` is the master switch. `catatia` ships with it set to `false`; deploying while it
is false creates the two Lambdas throttled off (reserved concurrency 0) and no schedule, so nothing
runs until you flip the flag.

---

## 3. Deploy commands

### 3.1 Interactive helper (recommended)

```bash
cd infra
bun run deploy            # full interactive flow
bun run deploy:check      # account + checklist only, deploys nothing
```

`bun run deploy` walks through three steps:

1. **Active AWS account** — lists every credential source it can find (the current shell, each
   `~/.aws` profile, the repo `.env` keys), shows the account and IAM identity each one resolves to,
   and lets you pick when more than one works. The chosen account is refused if it does not match the
   account the selected environment targets.
2. **Checklist** — for the chosen account + environment it reports what already exists: CDK
   bootstrap, the three stacks with their status, the media bucket / SSM parameters, the SQS queue
   pair, the secrets (distinguishing a real value from a CDK-generated placeholder), the two Lambdas,
   the dispatch schedule, the alarms, and (for VPC environments) the fixed NAT egress IP. Ends with
   `checklist: N/M satisfied`.
3. **What to deploy** — `1` storage · `2` data · `3` workers · `4` full deployment
   (storage → data → workers) · `5` diff only (no changes) · `6` exit. Every deploy asks for an
   explicit `yes` first, warns when a worker-critical secret is still a placeholder, and reminds you
   that secrets must be seeded before the workers deploy.

Warnings in the checklist are actionable, not cosmetic: `placeholder-looking` means the container
exists but still holds the value CDK generated at creation, so a job needing it will fail.

### 3.2 Plain commands

Run from the `infra/` folder. `PRAYER365_ENV` selects the config file.

```bash
cd infra
export PRAYER365_ENV=catatia

bun install                                  # first time only
bunx cdk diff   -c env=$PRAYER365_ENV        # read-only: show what would change
bun run deploy:data                          # SQS + secrets (+ RDS for a client)
bun run deploy:workers                       # Lambdas + schedule + alarms
bun run deploy:storage                       # bucket (clients only)
bun run deploy:all                           # everything

# deploy one component only, without touching its dependencies
bunx cdk deploy prayer365-$PRAYER365_ENV-workers -c env=$PRAYER365_ENV --exclusively

bun run destroy:all                          # throw-away / retired environments only
```

Recommended order for a fresh environment: `deploy:storage` → `deploy:data` → seed secrets
(section 4) → deploy the web app once so migrations run → `deploy:workers`.

Never run `destroy:all` against an environment whose config uses `removalPolicy: 'retain'`: that
policy protects the database and bucket, and `cdk destroy` will fail rather than delete them.

---

## 4. Values the code cannot invent

Most of this section is a human step (credentials, DNS, provider accounts). Secret seeding is the
exception: `seed-secrets.ts` does it from a local file, with a diff and a confirmation. Nothing here may
be committed to the repository.

### 4.1 Seed the seven secrets (once per environment, and after any value change)

The Data stack only creates the containers; CDK fills them with a random placeholder. The values are
written by `infra/scripts/seed-secrets.ts`, which reads them from a local env file, prints a masked diff,
asks for confirmation and verifies the read-back:

```bash
# catatia: values from .env, credentials from the admin keys inside it
bunx tsx infra/scripts/seed-secrets.ts --env catatia --dry-run     # preview, no writes
bunx tsx infra/scripts/seed-secrets.ts --env catatia              # write after "y"

# prayer-365: values from .env.prod, credentials from the AWS profile catatia_dev
bunx tsx infra/scripts/seed-secrets.ts --env prayer-365 --dry-run
bunx tsx infra/scripts/seed-secrets.ts --env prayer-365

# only some secrets (e.g. while the notification values do not exist yet)
bunx tsx infra/scripts/seed-secrets.ts --env catatia --only stripe-secret-key,mail-credentials

# a new device-token key, to paste into the web app and .env
bunx tsx infra/scripts/seed-secrets.ts --print-device-key
```

`bash infra/scripts/deploy.sh` wraps this as menu option **3**, and runs it automatically before the
workers deploy (option 4/5), because the Lambda env vars are CloudFormation references resolved at deploy
time — seeding after a deploy leaves the old value in the running function.

Which local file feeds which environment:

| File           | App it configures                                  | AWS account / secrets prefix                                                        |
| -------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `.env`         | local development (mixed, whatever the task needs) | catatia `430118850592` (`/prayer365/catatia/*`)                                     |
| `.env.staging` | staging app, `https://prayer-365.catatia.com`      | catatia `430118850592` (`/prayer365/catatia/*`) — same stack and database as `.env` |
| `.env.prod`    | client production                                  | `007091975568` (`/prayer365/prayer-365/*`)                                          |

Because `.env` and `.env.staging` target the same secrets, seeding with the wrong file is a silent
mistake (staging carries a different `ELEVENLABS_API_KEY`, for example). The script therefore rejects a
`--file` that is not the environment default unless `--allow-file` is passed.

| Secret                     | Built from                                                                     | Notes                                               |
| -------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| `database-url`             | `DATABASE_URL`                                                                 | must be a `postgres://` / `postgresql://` URL       |
| `elevenlabs-api-key`       | `ELEVENLABS_API_KEY`                                                           | must pass the ElevenLabs API or audio jobs fail     |
| `stripe-secret-key`        | `STRIPE_SECRET_KEY`                                                            | `sk_` / `rk_`                                       |
| `stripe-webhook-secret`    | `STRIPE_WEBHOOK_SECRET`                                                        | `whsec_`                                            |
| `mail-credentials`         | `MAIL_PROVIDER` + that provider's keys                                         | `ses` → `{}`; mailgun/mailtrap → user+password JSON |
| `device-token-key`         | `DEVICE_TOKEN_KEY`                                                             | base64 32 bytes, **same value as the web app**      |
| `firebase-service-account` | `FIREBASE_SERVICE_ACCOUNT` (JSON or base64) or `FIREBASE_SERVICE_ACCOUNT_FILE` | service-account JSON for FCM                        |

Values are masked unless `--show-values`; `unchanged` secrets are never written; if any secret cannot be
built from the chosen file the run stops before writing anything and names the missing keys.

`--check-only` prints how many secrets differ, which `deploy.sh --check` uses for its checklist line.

Fallback, when the script cannot be used:

```bash
aws secretsmanager put-secret-value --secret-id /prayer365/catatia/database-url \
  --secret-string 'postgresql://USER:***@HOST:25060/DATABASE?sslmode=require'
# mail-credentials for SES: '{}' ; for Mailgun: '{"MAILGUN_USER":"...","MAILGUN_PASSWORD":"..."}'
```

The Data stack creates the containers. It never stores a value.

### 4.2 Enable the worker component

**First, prove the artifact can reach the database** (no AWS deploy needed). From the repository root:

```bash
cd infra && bunx cdk synth -c env=<env> --quiet && bun run proof:db
# expect: database host: <host>
#         consumer.handler -> {"batchItemFailures":[]}
#         PROOF OK: the Lambda artifacts reached the database and ran
# add JOBS_QUEUE_URL=<queue url> to also run the dispatcher (it claims due rows,
# so only do this when the queue really exists)
```

`infra/scripts/lambda-db-proof.cjs` loads the two bundles CDK just built (the exact files Lambda
would upload), runs them under plain node with the repository `.env`, and prints the consumer result
and a dispatcher tick. It is read-only: the job id does not exist, so the controller returns
`skipped`. A failure here means credentials/network, not infrastructure.

Then:

1. Edit `infra/config/environments/catatia.ts` and set `workers.enabled: true`.
2. Run `PRAYER365_ENV=catatia bun run deploy:workers`.
3. Confirm the EventBridge rule `DispatchSchedule` is enabled and the three alarms are `OK`.
4. Post-deploy connectivity check: `aws lambda invoke --function-name prayer365-catatia-dispatcher /dev/stdout`
   and look for `job_dispatch_tick` in the response or in CloudWatch. A timeout/`ECONNREFUSED` there
   means the database firewall blocks the Lambda — see the `network.mode` table in section 2.

To pause the workers without deleting anything: set `workers.dispatchSchedule: 'off'` (or
`workers.enabled: false`) and redeploy the worker stack. Jobs that arrive meanwhile wait as
`PENDING` rows and run on the next tick after you re-enable it.

### 4.3 ElevenLabs switch

`ELEVENLABS_ENABLED` must be exactly `true` — the worker stack sets it. For local runs set it in
`.env` as well, otherwise every `audio.generate` job finishes `FAILED` with the error code
`ELEVENLABS_DISABLED`.

### 4.4 Alarm notifications

Set `alarmEmail` in the environment config before deploying the worker stack, then confirm the SNS
subscription e-mail. Without it the alarms exist but nobody is notified.

### 4.5 Client account onboarding (from a fresh AWS account to a running environment)

`infra/config/environments/client-example.ts` is the **template** for a client-owned account: it is a
placeholder config (account `000000000000`) that a real client file is copied from. It exists so the
shape of a client environment is reviewable in code — it is never deployed as-is.

What differs from `catatia`:

|                   | catatia (yours)                                          | a client environment                                                          |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Storage           | reuses the shared `bucket-catatia` (`mode: existing`)    | own bucket `prayer365-<client>-media` (`mode: create`)                        |
| Database          | external (DigitalOcean)                                  | RDS PostgreSQL 16, `db.t4g.micro`, 20 GB, single-AZ, private (`mode: create`) |
| Network           | Lambdas outside a VPC (no NAT)                           | VPC + NAT instance + fixed Elastic IP (`mode: vpc`)                           |
| removalPolicy     | `destroy` (throw-away)                                   | `retain` (data must survive a stack delete)                                   |
| Created resources | SSM parameters, queue pair, secret containers, 2 Lambdas | all of the above **plus** bucket, VPC, NAT instance, RDS, Elastic IP          |

#### Collect from the client first

1. AWS account ID and the region to use (`ap-southeast-1` unless they require otherwise).
2. One-time admin access (an IAM user or role that can create IAM/CloudFormation resources) for the
   bootstrap and the first deploys — or someone on their side running the two commands below.
3. Database credentials policy: use the generated RDS master password (stored in Secrets Manager),
   or their own.
4. The Stripe keys, ElevenLabs key, mail credentials and the alarm e-mail address.

#### Steps

```bash
# 1. create the client environment file (one per client)
cp infra/config/environments/client-example.ts infra/config/environments/<client>.ts
#    edit: name: '<client>', account: '<their account id>', region: '<their region>'
#          alarmEmail: '<ops mailbox>'   (optional but recommended)
#          keep storage/database/network as-is unless the client requires otherwise

# 2. register it — one line in the registry
#    infra/config/index.ts:   import { <client> } from './environments/<client>'
#                             '<client>': <client>,
bunx tsx infra/scripts/print-config.ts --list     # your new env must appear here

# 3. activate their credentials, then bootstrap CDK once (needs their admin access)
export AWS_PROFILE=<client-admin>                 # or export their keys
export CDK_DEFAULT_ACCOUNT=<their account id>
bunx cdk bootstrap aws://<their account id>/<region>

# 4. deploy with the helper (it re-checks the account for you)
cd infra
bun run deploy:check        # shows the empty checklist for the new account
bun run deploy              # choose 4) full deployment
```

`bun run deploy` refuses to continue if the active account is not the account in the client config, so
a wrong profile is caught before anything is created. The `data` component is the slow one (VPC, NAT
instance, RDS): expect about 10 minutes.

#### After the infrastructure exists

5. **Seed the secrets with client values** (section 4.1, replacing `catatia` with `<client>`):
   `database-url`, `elevenlabs-api-key`, `stripe-secret-key`, `stripe-webhook-secret`,
   `mail-credentials`. The `database-url` value is
   `postgresql://<user>:<password>@<RDS endpoint>:5432/prayer365?sslmode=require`, with the endpoint
   from the `DatabaseEndpoint` stack output (the password is in the RDS-managed secret
   `<db-instance>-secret`). The checklist marks a secret as `placeholder-looking` until this is done.
6. **Run the migrations** against the private RDS instance through the NAT instance:
   ```bash
   aws ec2 describe-instances --filters "Name=tag:Name,Values=*prayer365-<client>*" \
     --query 'Reservations[].Instances[].InstanceId' --output text    # NAT / bastion instance
   aws ssm start-session --target <instance-id> \
     --document-name AWS-StartPortForwardingSessionToRemoteHost \
     --parameters host=<rds-endpoint>,portNumber=5432,localPortNumber=5432
   # in another shell, with DATABASE_URL pointing at localhost:5432:
   bunx prisma migrate deploy
   ```
   Fallback when SSM is not available: temporarily set `publiclyAccessible: true` with the operator IP
   in the security group, migrate, then revert — and redeploy `data`.
7. **Deploy the workers** (only after the secrets have real values, because Lambda environment
   variables resolved from Secrets Manager are baked in at deploy time): `bun run deploy` → option 3,
   or `PRAYER365_ENV=<client> bun run deploy:workers`.
8. **Point the web app at the client database**: create the Vercel project environment with the client
   `DATABASE_URL`, `AWS_BUCKET_NAME` (`prayer365-<client>-media`), the Stripe/ElevenLabs/mail values and
   the `NEXT_PUBLIC_*` settings (section 4.6).
9. **Verify**: `bun run deploy:check` (expect the checklist green), `bun run proof:db` (the built
   Lambda reaches their database), then one smoke job through the API (section 7.4) and a look at the
   CloudWatch alarms.
10. **Hand over**: account owner, region, bucket name, queue URLs, secret names, the NAT egress IP, the
    alarm topic, and the teardown sequence for a retired client.

#### Ground rules

- Never store a client's secret values in this repository; they go into Secrets Manager only.
- Keep `removalPolicy: 'retain'` for clients: it stops `cdk destroy` from deleting their database and
  bucket.
- The free tier covers the RDS instance for 12 months (`db.t4g.micro` + 20 GB); afterwards budget
  roughly USD 13–15/month. The NAT instance plus its IPv4 address adds about USD 7/month and is not
  free-tier. Tell the client this before they approve.

### 4.6 Vercel environment variables

`cdk deploy --all -c env=<env> --outputs-file env-<env>.json` writes the stack outputs. The web app
needs:

| Stack output                     | Vercel variable                                                         |
| -------------------------------- | ----------------------------------------------------------------------- |
| `BucketName`                     | `AWS_BUCKET_NAME`                                                       |
| `DatabaseEndpoint` (client envs) | part of `DATABASE_URL`                                                  |
| the five secret values           | the matching `DATABASE_URL`, `ELEVENLABS_API_KEY`, `STRIPE_*`, `MAIL_*` |

`JOBS_QUEUE_URL`, `JOB_CLAIM_LIMIT` and `JOB_LEASE_SECONDS` belong to the Lambda workers only —
leave them empty on Vercel.

### 4.7 Retiring an environment

```bash
cd infra && PRAYER365_ENV=<env> bun run destroy:all
```

Then confirm in the console that no bucket, RDS snapshot, log group, SNS topic or secret container
remains. Secrets are retained by default when they hold values; delete them explicitly if the
client requires it.

---

## 5. Job kinds

| Kind                | Produced by                       | Processed by                       | Timeout |
| ------------------- | --------------------------------- | ---------------------------------- | ------- |
| `audio.generate`    | prayer approval (provider)        | `processAudioGenerateJob`          | 900 s   |
| `prayer.publish`    | scheduled publish scan + approval | `processPrayerPublishJob`          | 900 s   |
| `payment.sync`      | Stripe webhook handler on Vercel  | `processPaymentSyncJob`            | 900 s   |
| `voice.register`    | voice profile approval            | `processVoiceRegisterJob`          | 900 s   |
| `notification.send` | `src/providers/notification.tsx`  | **none yet** — rows stay `PENDING` | —       |

Adding a kind: write the controller (`src/controller/<name>-job.tsx`) and its test, add a local
runner in `workers/<name>.ts`, then add one line to `HANDLERS` in `src/lambda/consumer.ts` and one
line to `SUPPORTED_KINDS` in `src/controller/job-dispatch.ts`. The guard test
`src/lambda/kinds.test.tsx` fails the build if a provider enqueues a kind that no worker handles.
No infrastructure change and no database migration is needed for a new kind.

---

## 6. Routine operations

| Task                            | How                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| See job history                 | `aws sqs get-queue-attributes --queue-url <dlq-url> --attribute-names ApproximateNumberOfMessages` and the Lambda log groups in CloudWatch |
| Inspect a failed job            | CloudWatch Logs → `/aws/lambda/prayer365-<env>-consumer`, search `job_processing_failed`                                                   |
| Redrive the DLQ                 | Console → the DLQ → _Start DLQ redrive_, or `aws sqs start-message-move-task`                                                              |
| Confirm workers are alive       | CloudWatch → dispatcher invocations every minute; or `aws lambda invoke --function-name prayer365-<env>-dispatcher /dev/stdout`            |
| Grant a job more time or memory | add a `workers.routes[]` entry in the env config, then redeploy the worker stack                                                           |
| Migrate the database            | runs inside the Vercel build (`bun run build` → `prisma migrate deploy`); deploy the web app before the worker stack                       |
| Rotate the ElevenLabs key       | `put-secret-value` on `/prayer365/<env>/elevenlabs-api-key`; Lambdas read it on every cold start, so no redeploy is needed                 |

---

## 7. Deployment record — catatia, 14 October 2026

First real deployment of the AWS side, done in this order. The ordering matters: the worker stack
reads the SSM parameters written by `storage`/`data`, and Lambda environment variables resolved from
Secrets Manager are baked in **at deploy time**, so the secrets must be seeded before the worker
stack is deployed (otherwise the functions keep the placeholder value until the next deploy).

### 7.1 Steps, with the exact commands and observed result

| #   | Command (from the repository root)                                                                                                             | Result                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `aws sts get-caller-identity` · `aws cloudformation describe-stacks --stack-name CDKToolkit` · `bunx cdk --version`                            | Account `430118850592`, CDKToolkit `CREATE_COMPLETE`, CDK `2.1145.0`. No `prayer365` resources existed yet                                                                                     |
| 1   | `PRAYER365_ENV=catatia bun run deploy:storage`                                                                                                 | `prayer365-catatia-storage` ✅ in 6 s. Two SSM parameters, output `BucketName = bucket-catatia`. No S3 resources touched                                                                       |
| 2   | `PRAYER365_ENV=catatia bun run deploy:data`                                                                                                    | `prayer365-catatia-data` ✅ in 68 s. Queue `prayer365-catatia-jobs` + `-jobs-dlq`, five secret containers                                                                                      |
| 3   | `aws secretsmanager put-secret-value --secret-id /prayer365/catatia/database-url --secret-string "$DATABASE_URL"` (and `elevenlabs-api-key`)   | New versions `AWSCURRENT` on both secrets. Values never printed                                                                                                                                |
| 4   | `infra/config/environments/catatia.ts` → `workers.enabled: true`                                                                               | Config flip; no separate deploy                                                                                                                                                                |
| 5   | `PRAYER365_ENV=catatia bun run deploy:workers`                                                                                                 | `prayer365-catatia-workers` ✅ in 114 s. Two Lambdas, log groups (14-day retention), three alarms, one SNS topic, EventBridge rule `rate(1 minute)` `ENABLED`                                  |
| 6   | `aws lambda list-functions` · `aws events list-rules --name-prefix prayer365` · `aws cloudwatch describe-alarms --alarm-name-prefix prayer365` | dispatcher `nodejs22.x` 512 MB / 60 s; consumer `nodejs22.x` 1024 MB / 900 s; alarms `OK`, `OK`, `INSUFFICIENT_DATA` (normal until the first error metric arrives)                             |
| 7   | `aws lambda invoke --function-name prayer365-catatia-dispatcher --payload '{}' out.json`                                                       | `StatusCode 200`, `FunctionError null`, payload `{"scanned":0,"byKind":{...}}`, log line `job_dispatch_tick`. **This is the proof that the Lambda reaches the DigitalOcean database from AWS** |
| 8   | `aws sqs send-message --queue-url <jobs> --message-body '{"kind":"prayer.publish","jobId":"00000000-0000-7000-8000-000000000000"}'`            | Consumer log `job_processed` with `outcome":"skipped"`; jobs queue `0/0`; DLQ `0`                                                                                                              |

Skipped on purpose: nothing was sent to the DLQ, and the test job id does not exist, so no business
row was written.

### 7.2 Still outstanding for catatia

| #   | Item                                                                                                                                                                                                                                                                                | Command / action                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Stripe and mail secret values                                                                                                                                                                                                                                                       | `aws secretsmanager put-secret-value --secret-id /prayer365/catatia/stripe-secret-key --secret-string '...'` (same for `stripe-webhook-secret`). `mail-credentials` is only needed for the SMTP providers — SES sends with the Lambda role, so `{}` is enough there. Until then a `payment.sync` job cannot succeed |
| 2   | Alarm e-mail                                                                                                                                                                                                                                                                        | set `alarmEmail` in the environment config and redeploy `workers`, then confirm the SNS subscription. Today the alarms exist but nobody is notified                                                                                                                                                                 |
| 3   | Pause the schedule if the environment is idle                                                                                                                                                                                                                                       | `workers.dispatchSchedule: 'off'` + `bun run deploy:workers` (the rule currently fires every minute and dispatches nothing)                                                                                                                                                                                         |
| 4   | Reset the two rows left `FAILED` by the earlier local worker check                                                                                                                                                                                                                  | SQL in the plan §0.1                                                                                                                                                                                                                                                                                                |
| 5   | Seeded demo data: the demo voice profile had a placeholder `provider_voice_id` (`demo_voice_id`), so ElevenLabs refused every audio job. It now points at a real premade voice (`EXAVITQu4vr4xnSDxMaL`, "Sarah"); swap it for the pastor's cloned voice when that flow is exercised | `UPDATE voice_profiles SET provider_voice_id = '<real voice id>' WHERE id = '01a0f73b-96bb-75ef-9857-fac212d18ad8'`                                                                                                                                                                                                 |

### 7.3 Cost of what is now running

SQS (two queues, nearly zero traffic), two Lambda functions (one invocation per minute, ~0.1 s each),
one SNS topic, six CloudWatch alarms, CloudWatch Logs with 14-day retention. Well under USD 1/month
at this traffic. No VPC, no NAT, no database instance was created.

### 7.4 End-to-end API test — `audio.generate` through the real worker (14 Oct 2026)

The pipeline was exercised through a real HTTP API, not a simulated job:

| #   | Step                                                                                                                                                    | Result                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /api/auth/callback/credentials` with `name=admin@catatia.com` + password (the app's credentials provider declares the identifier field as `name`) | 302 → `/dashboard`, session cookie stored                                                                                          |
| 2   | `POST /api/v1/admin/churches/{churchId}/prayers/{prayerId}/audio` with `{version, prayerVersionId, voiceProfileId}` and an `Idempotency-Key`            | **202** — `PrayerAudio` row `QUEUED`, `audio.generate` outbox row created in the same transaction                                  |
| 3   | Dispatcher tick (EventBridge, every minute)                                                                                                             | log: `job_dispatch_tick {"audio.generate":1}`                                                                                      |
| 4   | Consumer Lambda                                                                                                                                         | `job_processed outcome:"succeeded"`, ElevenLabs request id returned                                                                |
| 5   | Final state                                                                                                                                             | `prayer_audio status=READY`, `media_asset status=READY`, object `media/<church>/generated_audio/<uuid>` (audio/mpeg, 26,793 bytes) |
| 6   | Public read (what the mobile app does)                                                                                                                  | `HTTP 200`, `content-type: audio/mpeg`, `size 26,793`                                                                              |

Two defects were found and fixed by this test — both would have hit production:

| #   | Defect                                                 | Evidence                                                                                                                                                                                                                                                                                                                   | Fix                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Lambda S3 uploads failed with `InvalidAccessKeyId`** | CloudWatch: `audio_generate_job_error` → `The AWS Access Key Id you provided does not exist in our records.` The S3 provider passed `accessKeyId` + `secretAccessKey` from env but dropped `AWS_SESSION_TOKEN`; on Lambda those env credentials are the execution role's _temporary_ pair, so the key alone is meaningless | `src/providers/s3.tsx` now forwards `AWS_SESSION_TOKEN` when present (static keys on Vercel/local are unaffected). Unit tests assert both shapes                                                                             |
| 2   | **Unexpected job failures were invisible**             | The audio/publish/payment job controllers turned any unexpected exception into `INTERNAL_JOB_ERROR` **without logging it**, so CloudWatch showed only `outcome:"requeued"`                                                                                                                                                 | All four job controllers now log `error_code` + `error_name` + `error_message` before requeueing. `error_message` is used deliberately: a field named `message` is redacted by the logger (it guards private request bodies) |

Both went through the full loop: local reproduction → root cause → fix → unit test → redeploy → re-run the API → green. The same call after the fix produced `outcome:"succeeded"` and a playable object.

To repeat this test by hand, see the sequence in the table above; the session cookie comes from `POST /api/auth/callback/credentials` with the form fields `name` (the e-mail), `password`, `csrfToken` and `callbackUrl`.

### 7.5 Production verification — Vercel app → Lambda → SQS → database (14 Oct 2026)

The same pipeline was re-verified against the **live site** (`https://prayer-365.catatia.com`), so the
request entered the Vercel deployment and the work was done by the deployed Lambdas:

| #   | Step                                                                    | Evidence                                                                                       |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Login on production (`POST /api/auth/callback/credentials`)             | `302 → /dashboard`; session returns `admin@catatia.com`                                        |
| 2   | Create a test prayer (`POST /api/v1/admin/churches/{churchId}/prayers`) | 200 → prayer `01a139d5-394b-75b8-a349-5b4c1eccefa8`                                            |
| 3   | Approve its text (`POST …/approve-text`)                                | 200, `approvedAt` set                                                                          |
| 4   | Enqueue audio (`POST …/audio`, `Idempotency-Key`)                       | **202**, `PrayerAudio` QUEUED (09:55:35Z), id `01a139d6-b7fb-766d-b0a3-632f6d678fb6`           |
| 5   | Dispatcher tick (EventBridge, 1 min)                                    | `job_dispatch_tick {"audio.generate":1}` at 09:56:02Z                                          |
| 6   | Consumer Lambda                                                         | `job_processed outcome:"succeeded"` at 09:56:06.674Z (3.2 s)                                   |
| 7   | Final state                                                             | audio `READY`, outbox `SUCCEEDED attempts=1`, asset `READY`, `audio/mpeg`, **54,796 bytes**    |
| 8   | Public media read (mobile path)                                         | `HTTP 200`, `content-type: audio/mpeg`, 54,796 bytes                                           |
| 9   | Read back through the app                                               | `GET …/prayers/{id}` → `latestAudioId` = the new audio, `latestAudioStatus: "READY"`           |
| 10  | Queues and alarms after the run                                         | jobs queue `0/0`, DLQ `0`, all three alarms `OK`; rule enabled, SQS trigger `Enabled`, batch 5 |

Latency was about 31 seconds and `attempts=1` proves single delivery: the Vercel app and the Lambdas
share one database, which is the design.

Two API details that cost a retry each — know them before a smoke test:

| Symptom                                               | Cause                                                                                                                             | Fix                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `409 STALE_VERSION` after a successful `approve-text` | approval bumps the prayer's optimistic `version` counter                                                                          | Read `prayer.version` back before the audio call and send the new number |
| Malformed request path returned `308 Redirecting...`  | the response payload is nested under `result`, not `data`, so a `data.*` parse produced an empty id and the URL collapsed to `//` | Parse `result.*`                                                         |

Also: every prayer with an approved current version already has audio, and the enqueue endpoint rejects
a non-current version — so testing a _new_ job means creating a fresh prayer through the API
(`POST …/prayers` → `approve-text` → `audio`), which is what steps 2–4 do.

---

### 7.6 Deployment record — `prayer-365` (client account 007091975568, 23 October 2026)

| #   | Step                                                                                                 | Result                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 0   | profile `prayer-365` (IAM user `catatia_dev`, `AdministratorAccess`) → `aws sts get-caller-identity` | account 007091975568, region `eu-north-1`; empty account (0 stacks, buckets, secrets, RDS)                             |
| 1   | `infra/config/environments/prayer-365.ts` + the registry line                                        | `print-config.ts --list` → catatia, client-example, prayer-365                                                         |
| 2   | `bunx cdk bootstrap aws://007091975568/eu-north-1`                                                   | CDKToolkit `CREATE_COMPLETE` (assets + container-assets buckets)                                                       |
| 3   | `PRAYER365_ENV=prayer-365 bun run deploy:storage`                                                    | ✅ 26 s; bucket `prayer365-prayer-365-media`                                                                           |
| 4   | `PRAYER365_ENV=prayer-365 bun run deploy:data`                                                       | ✅ ~5 min: queue pair, five secret containers, VPC, NAT instance + EIP `13.49.140.221`, public RDS `available`         |
| 5   | seed `/prayer365/prayer-365/database-url`                                                            | master user + generated password read from the CDK-created `PostgresSecret<hash>-<suffix>` secret; value never printed |
| 6   | `DATABASE_URL=… bunx prisma migrate deploy`                                                          | direct connection (public instance, no SSM tunnel): 29 migrations applied, status "up to date"                         |
| 7   | `PRAYER365_ENV=prayer-365 bun run deploy:workers`                                                    | ✅ 2 Lambdas, EventBridge rule `rate(1 minute)` `ENABLED`, 3 alarms `OK`                                               |
| 8   | `aws lambda invoke --function-name prayer365-prayer-365-dispatcher`                                  | `StatusCode 200`, payload `{"scanned":0,…}`, log `job_dispatch_tick` — the Lambda reaches the new RDS instance         |

Checklist after step 8: **16/17**. The one gap is `elevenlabs-api-key` (still the CDK-generated
placeholder) — the client's ElevenLabs, Stripe and mail values are not in hand yet, and because Lambda
environment variables from Secrets Manager are resolved at deploy time, the worker stack must be
redeployed once they are seeded.

Two defects were found and fixed during this deployment:

| #   | Defect                                                               | Cause / fix                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `deploy.sh` reported the media bucket as missing although it existed | the check used `aws s3api head-bucket`, which takes no `--output`; an invalid default output in `~/.aws/config` (`output = JSON`, uppercase — the CLI only accepts lowercase) made it fail with `Unknown output type: JSON`. The check now uses `aws s3api list-buckets`, and the profile was corrected with `aws configure set output json --profile prayer-365` |
| 2   | A private RDS instance would have been reachable by nothing          | the RDS construct's default security group has no inbound rules. The data stack now always adds one: the VPC CIDR for a private instance, `0.0.0.0/0` for a public one                                                                                                                                                                                            |

---

## 8. Known limitations

| #   | Item                                                    | Note                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Media is world-readable                                 | **Accepted permanently** (client decision 2026-10-21, D13): public reads for every purpose, no signed reads, no expiring URLs. A distributed object URL cannot be revoked, so withdrawn content may still be fetchable by an old link — accepted |
| 2   | Deploy role uses broad permissions                      | `cdk deploy` needs IAM write access. Only the account owner runs deploys today; scope the role down before a second operator or CI is added                                                                                                      |
| 3   | Client environments need credentials even to synthesize | The VPC + NAT instance does an AMI lookup; `cdk context` caches it after the first successful run                                                                                                                                                |
| 4   | `notification.send` has no worker                       | Documented in section 5; the dispatcher skips it on purpose                                                                                                                                                                                      |
| 5   | One environment (catatia) today                         | Staging and production separation means adding a second config file, not code changes                                                                                                                                                            |
