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
  | { mode: 'vpc'; natInstanceType: string; staticEgressIp: boolean }

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

export type EnvConfig = {
  name: string
  account: string
  region: string
  removalPolicy: 'retain' | 'destroy'
  /** Repo allowed to assume the deploy role through GitHub OIDC. */
  githubRepo: string
  storage: StorageConfig
  database: DatabaseConfig
  network: NetworkConfig
  workers: WorkersConfig
  alarmEmail?: string
  logRetentionDays: number
}
