import type { EnvConfig } from '../types'

/*
 * Template for a client-owned AWS account: copy this file to
 * `environments/<client>.ts`, fill in the account id, register it in
 * `config/index.ts`, then follow docs/admin/INFRA-DEPLOY.md.
 *
 * Free-tier notes (12 months from account creation): db.t4g.micro + 20 GB gp3,
 * single-AZ, no standby. The NAT instance used for Lambda egress is NOT free
 * (~$4/month) — see the deploy doc.
 */
export const clientExample: EnvConfig = {
  name: 'client-example',
  account: '000000000000',
  region: 'ap-southeast-1',
  removalPolicy: 'retain',
  githubRepo: 'Catalyst-Inertia/prayer-365-dashboard',
  storage: { mode: 'create' },
  database: {
    mode: 'create',
    instanceType: 't4g.micro',
    storageGb: 20,
    backupRetentionDays: 7,
  },
  // The RDS instance is private, so the Lambdas run in the VPC behind a NAT
  // instance with a fixed egress IP (useful if other services allow-list it too).
  network: { mode: 'vpc', natInstanceType: 't4g.nano', staticEgressIp: true },
  workers: {
    enabled: true,
    dispatchSchedule: 'rate(1 minute)',
    claimLimit: 10,
    leaseSeconds: 900,
    consumerTimeoutSeconds: 900,
    consumerMemoryMb: 1024,
  },
  logRetentionDays: 30,
}
