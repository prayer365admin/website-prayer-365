import type { EnvConfig } from '../types'

/*
 * Catatia = the shared company AWS account, and also the throw-away account used
 * for deploy tests. It owns no PRAYER database (the app runs on DigitalOcean
 * managed PostgreSQL) and reuses the existing shared media bucket.
 */
export const catatia: EnvConfig = {
  name: 'catatia',
  account: '430118850592',
  region: 'ap-southeast-1',
  removalPolicy: 'destroy',
  githubRepo: 'Catalyst-Inertia/prayer-365-dashboard',
  storage: { mode: 'existing', bucketName: 'bucket-catatia' },
  database: { mode: 'external' },
  /*
   * The DigitalOcean endpoint is public, so the Lambdas run outside a VPC and
   * reach it over the internet with TLS — no VPC, no NAT, no extra cost.
   *
   * Switch to { mode: 'vpc', natInstanceType: 't4g.nano', staticEgressIp: true }
   * if the database ever gets a firewall/trusted-source allow-list: the NAT
   * instance then gives the Lambdas one fixed egress IP to allow-list.
   */
  network: { mode: 'public' },
  /*
   * Transactional email. The domain identity already exists in this account
   * (verified, DKIM SUCCESS, custom MAIL FROM mail.catatia.com), so it is adopted,
   * not created — the DNS records are in docs/admin/SES-DNS.md.
   */
  email: {
    mode: 'existing',
    domain: 'catatia.com',
    mailFromDomain: 'mail.catatia.com',
    provider: 'ses',
  },
  workers: {
    // Deployed on catatia 2026-10-14: dispatcher + consumer are live and the
    // schedule fires every minute. Set false to pause without deleting.
    enabled: true,
    dispatchSchedule: 'rate(1 minute)',
    claimLimit: 10,
    leaseSeconds: 900,
    consumerTimeoutSeconds: 900,
    consumerMemoryMb: 1024,
  },
  logRetentionDays: 14,
}
