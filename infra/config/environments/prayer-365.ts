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
  // Apex 308-redirects to www, so www is the canonical origin mail links use.
  appUrl: 'https://www.prayer365.eu',
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
  // The data stack keeps its VPC + NAT instance (the RDS instance lives in that VPC and
  // moving it would replace the database), but the WORKER Lambdas stay out of it:
  // `lambdaInVpc: false`. A Lambda inside a VPC has no public IP, so its whole egress
  // depends on the NAT — and this stack's t4g.nano cannot provide it (512 MB OOMs while
  // installing iptables, so nothing is masqueraded and every SQS/S3/Stripe/SMTP call
  // times out). Outside the VPC the workers reach those services directly and use the
  // same public RDS endpoint the Vercel app already uses.
  network: {
    mode: 'vpc',
    natInstanceType: 't4g.nano',
    staticEgressIp: true,
    lambdaInVpc: false,
  },
  // Transactional email: prayer365.eu has to be verified in this account's SES.
  // The DKIM + MAIL FROM records the domain owner must publish are printed by the
  // data stack and listed in docs/admin/SES-DNS.md.
  email: {
    mode: 'create',
    domain: 'prayer365.eu',
    mailFromDomain: 'mail.prayer365.eu',
    provider: 'brevo',
  },
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
