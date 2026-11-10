/*
 * Environment configuration for the PRAYER 365 CDK app.
 *
 * One file per deployment target under `config/environments/`, selected with
 * `-c env=<name>`. Account ids and regions are DATA here, never literals inside
 * resources — that is what makes "same code, another client account" work.
 */

export type StorageConfig =
  /** Reuse a bucket that already exists (catatia uses the shared company bucket). */
  | { mode: 'existing'; bucketName: string }
  /** Create a dedicated media bucket for this environment. */
  | { mode: 'create' }

export type DatabaseConfig =
  /** The database lives outside this account (catatia: DigitalOcean managed PostgreSQL). */
  | { mode: 'external' }
  /** Create an RDS PostgreSQL instance (free-tier friendly defaults per environment). */
  | {
      mode: 'create'
      instanceType: string
      storageGb: number
      backupRetentionDays: number
      /**
       * Place the instance in a PUBLIC subnet and give it a public endpoint.
       *
       * Required when the web app runs outside this account (Vercel): it has no
       * fixed egress IPs, so the security group has to be open to the internet.
       * TLS (`sslmode=require`) plus the RDS-generated password are the guard.
       *
       * `false` keeps the instance private — only reachable from inside the VPC,
       * which means the web app cannot connect.
       */
      publiclyAccessible: boolean
    }

/**
 * Where the Lambdas run, which is what decides how they reach the database.
 * The application code is identical in both modes: it always connects to the
 * `DATABASE_URL` secret, so the database may live anywhere (RDS, DigitalOcean,
 * Neon, Supabase, on-prem behind a tunnel).
 */
export type NetworkConfig =
  /** Lambda outside a VPC. Works with any PUBLIC database endpoint. No VPC cost. */
  | { mode: 'public' }
  /**
   * Lambda in VPC private subnets behind a NAT instance. Required when the
   * database is private (RDS) or when it only accepts allow-listed source IPs
   * (`staticEgressIp: true` gives the NAT instance a fixed Elastic IP to add to
   * that allow-list). Costs ~$4/month for the instance plus ~$3.6 for the IP.
   */
  | {
      mode: 'vpc'
      natInstanceType: string
      staticEgressIp: boolean
      /**
       * Keep the WORKER Lambdas out of the VPC even though the stack creates one.
       *
       * A Lambda inside a VPC gets no public IP, so all its egress must go through
       * the NAT; with a public database endpoint (the shape Vercel already uses) the
       * workers do not need the VPC at all. Set `false` when the NAT cannot provide
       * reliable egress — a VPC-less Lambda reaches SQS, S3, Stripe and SMTP directly.
       */
      lambdaInVpc?: boolean
    }

export type WorkersConfig = {
  /** Master switch for the worker component (dispatcher + consumer + schedule). */
  enabled: boolean
  /** EventBridge schedule expression, or 'off' to pause dispatch without deleting anything. */
  dispatchSchedule: string
  /** Max outbox rows claimed per kind per dispatcher run. */
  claimLimit: number
  /** Outbox lease in seconds; must be >= the consumer timeout. */
  leaseSeconds: number
  /** Consumer Lambda timeout in seconds (audio TTS needs headroom; Lambda max is 900). */
  consumerTimeoutSeconds: number
  consumerMemoryMb: number
}

export type EmailConfig = {
  /** Domain verified in SES for this environment. */
  domain: string
  /**
   * Custom MAIL FROM subdomain (better SPF alignment with DMARC). SES expects the
   * MX + TXT records listed in docs/admin/SES-DNS.md to be published. For an
   * adopted identity it only records what the domain already has configured.
   */
  mailFromDomain?: string
  /**
   * `create` makes the domain identity and emits the DKIM records the domain owner
   * must publish. `existing` adopts a domain someone already verified in this
   * account's SES (catatia.com) — CDK cannot read an imported identity's DKIM
   * tokens, so read those with `aws sesv2 get-email-identity`.
   */
  mode: 'create' | 'existing'
  /**
   * Transport the workers use, mirrored into the Lambda `MAIL_PROVIDER` env var.
   * A `MAIL_PROVIDER` key inside the mail-credentials secret is ignored on purpose:
   * provider selection is deployment configuration, not a credential.
   */
  provider: 'ses' | 'mailgun' | 'mailtrap' | 'brevo'
}

export type EnvConfig = {
  name: string
  account: string
  region: string
  removalPolicy: 'retain' | 'destroy'
  /** Repo allowed to assume the deploy role through GitHub OIDC. */
  githubRepo: string
  /**
   * Public origin of the web app, without a trailing slash. Mail templates build
   * their links from it (`BASE_URL`), and notification mail is enqueued INSIDE the
   * consumer Lambda — so the origin has to reach the worker environment, not just
   * Vercel. Use the canonical host (the one that does not redirect), otherwise
   * every link costs a redirect.
   */
  appUrl: string
  storage: StorageConfig
  database: DatabaseConfig
  network: NetworkConfig
  email: EmailConfig
  workers: WorkersConfig
  alarmEmail?: string
  logRetentionDays: number
}
