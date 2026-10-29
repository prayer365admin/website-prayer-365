import type { EnvConfig } from '../types'

/*
 * Client-owned AWS account. Fresh account (no CDK bootstrap at creation time).
 *
 * Free-tier notes (12 months from account creation): db.t4g.micro + 20 GB gp3,
 * single-AZ, no standby. The NAT instance used for Lambda egress is NOT free
 * (~$4/month) plus its public IPv4 (~$3.6/month).
 */
export const prayer365: EnvConfig = {
  name: 'prayer-365',
  account: '007091975568',
  region: 'eu-north-1',
  removalPolicy: 'retain',
  githubRepo: 'Catalyst-Inertia/prayer-365-dashboard',
  storage: { mode: 'create' },
  database: {
    mode: 'create',
    instanceType: 't4g.micro',
    storageGb: 20,
    backupRetentionDays: 7,
    // The web app runs on Vercel, which has no fixed egress IPs: the instance
    // must be reachable from the internet (open security group + TLS).
    publiclyAccessible: true,
  },
  // The Lambdas run in the VPC behind a NAT instance (fixed egress IP, usable for
  // the client's own allow-lists). The database itself is public because Vercel
  // hosts the web app and has no fixed egress IPs.
  network: { mode: 'vpc', natInstanceType: 't4g.nano', staticEgressIp: true },
  // Transactional email: prayer365.eu has to be verified in this account's SES.
  // The DKIM + MAIL FROM records the domain owner must publish are printed by the
  // data stack and listed in docs/admin/SES-DNS.md.
  email: { mode: 'create', domain: 'prayer365.eu', mailFromDomain: 'mail.prayer365.eu' },
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
