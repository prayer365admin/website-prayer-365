# PRAYER 365 — SES domain identities and DNS records

| Field      | Value                                                                        |
| ---------- | ---------------------------------------------------------------------------- |
| Document   | SES-DNS — email identities, DNS records and sending prerequisites            |
| Version    | 1.0                                                                          |
| Date       | 23 October 2026                                                              |
| Author     | Catatia engineering                                                          |
| Approver   | [TBD]                                                                        |
| Applies to | `prayer-365-dashboard` — transactional email (Amazon SES), both AWS accounts |

---

## 1. Purpose

The application sends transactional email (verification, password reset, notices) through Amazon SES,
with the transport selected by the `MAIL_PROVIDER` environment variable. SES refuses to send from a
domain it has not verified, and verification depends on DNS records that only the domain owner can
publish. This document lists the exact records for each environment and how to confirm they worked.

Each environment has its own SES identity because SES is region-scoped and the two environments run in
different AWS accounts.

| Environment  | AWS account  | SES region       | Sending domain | From address                | DNS hosted at                                    | State                                                |
| ------------ | ------------ | ---------------- | -------------- | --------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `prayer-365` | 007091975568 | `eu-north-1`     | `prayer365.eu` | `do-not-reply@prayer365.eu` | Elkdata (`ns.elkdata.ee`, `ns3.elkdata.net`)     | Identity created; **records below still required**   |
| `catatia`    | 430118850592 | `ap-southeast-1` | `catatia.com`  | `do-not-reply@catatia.com`  | Cloudflare (`lovisa`/`conrad.ns.cloudflare.com`) | Verified and complete; one DMARC cleanup (section 5) |

The stack output `SesDomain` (and the SSM parameter `/prayer365/<env>/ses-domain`) carries the domain;
`SesDkimTokenName1..3` / `SesDkimTokenValue1..3` carry the DKIM values for a newly created identity.

---

## 2. Records to add — `prayer365.eu` (action required)

Add all six records to the `prayer365.eu` zone at Elkdata. The three CNAMEs are what SES verifies;
without them DKIM stays `PENDING` and every send is rejected.

| #   | Type  | Name                                          | Value                                                     | TTL  | Purpose                         |
| --- | ----- | --------------------------------------------- | --------------------------------------------------------- | ---- | ------------------------------- |
| 1   | CNAME | `om6x46xwasio36nvpwabcbx3unmp5n4g._domainkey` | `om6x46xwasio36nvpwabcbx3unmp5n4g.dkim.amazonses.com`     | 3600 | DKIM key 1 (required)           |
| 2   | CNAME | `uc4tjn7xhu7guyrlgksizeuootl6y7om._domainkey` | `uc4tjn7xhu7guyrlgksizeuootl6y7om.dkim.amazonses.com`     | 3600 | DKIM key 2 (required)           |
| 3   | CNAME | `gsfhzvutqsrwxingm4ciml7scterqocc._domainkey` | `gsfhzvutqsrwxingm4ciml7scterqocc.dkim.amazonses.com`     | 3600 | DKIM key 3 (required)           |
| 4   | MX    | `mail`                                        | `10 feedback-smtp.eu-north-1.amazonses.com` (priority 10) | 3600 | Custom MAIL FROM (SPF path)     |
| 5   | TXT   | `mail`                                        | `v=spf1 include:amazonses.com ~all`                       | 3600 | SPF for the MAIL FROM subdomain |
| 6   | TXT   | `_dmarc`                                      | `v=DMARC1; p=none; rua=mailto:dmarc@prayer365.eu`         | 3600 | DMARC (recommended, monitoring) |

Notes:

1. The CNAME **name** is the value from `SesDkimTokenName*` — most panels want only the part before the
   domain, i.e. `<token>._domainkey`. If the panel expects a full name, use
   `<token>._domainkey.prayer365.eu`.
2. Records 4 and 5 are only needed because the identity uses `mail.prayer365.eu` as its MAIL FROM
   domain. They are what makes SPF align with the From header under a strict DMARC policy.
3. Propagation is normally minutes; SES re-checks automatically, so no action is needed after publishing.

---

## 3. Records already in place — `catatia.com` (no action)

Verified live on 23 October 2026. Listed for completeness and for the handover record.

| #   | Type  | Name                                          | Value                                                 | State                     |
| --- | ----- | --------------------------------------------- | ----------------------------------------------------- | ------------------------- |
| 1   | CNAME | `gy45tvbb5ibj24kgiaojm5rv5k5miezx._domainkey` | `gy45tvbb5ibj24kgiaojm5rv5k5miezx.dkim.amazonses.com` | Live                      |
| 2   | CNAME | `k22hvsl4lt7idnzezjts75kdzxqc5l3t._domainkey` | `k22hvsl4lt7idnzezjts75kdzxqc5l3t.dkim.amazonses.com` | Live                      |
| 3   | CNAME | `ox2is4voqygnd5ptjmwi6s3lvjrb4oo6._domainkey` | `ox2is4voqygnd5ptjmwi6s3lvjrb4oo6.dkim.amazonses.com` | Live                      |
| 4   | MX    | `mail`                                        | `10 feedback-smtp.ap-southeast-1.amazonses.com`       | Live                      |
| 5   | TXT   | `mail`                                        | `v=spf1 include:amazonses.com ~all`                   | Live                      |
| 6   | TXT   | apex                                          | `v=spf1 -all`                                         | Live (apex sends nothing) |

SES state for this identity: `VerifiedForSendingStatus: true`, `DkimAttributes.Status: SUCCESS`,
MAIL FROM `mail.catatia.com` `SUCCESS`.

---

## 4. Verification

| Check                 | Command                                                                          | Expected                                               |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Identity state        | `aws sesv2 get-email-identity --email-identity prayer365.eu --region eu-north-1` | `VerifiedForSendingStatus: true`, DKIM `SUCCESS`       |
| DKIM CNAME resolves   | `dig +short CNAME om6x46xwasio36nvpwabcbx3unmp5n4g._domainkey.prayer365.eu`      | `om6x46xwasio36nvpwabcbx3unmp5n4g.dkim.amazonses.com.` |
| MAIL FROM resolves    | `dig +short MX mail.prayer365.eu`                                                | `10 feedback-smtp.eu-north-1.amazonses.com.`           |
| Environment checklist | `bash infra/scripts/deploy.sh --env prayer-365 --check`                          | `SES domain identity prayer365.eu verified`            |

---

## 5. Finding — duplicate DMARC record on `catatia.com`

`catatia.com` currently publishes **two** TXT records at `_dmarc`:

```
v=DMARC1; p=none;
v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s;
```

RFC 7489 treats a domain with more than one DMARC record as having **no** usable policy, so receivers
fall back to monitoring and the intended `p=reject` with strict alignment is not enforced. Action:
delete the `p=none` record at Cloudflare and keep the strict one. Confirm first with whoever added
`p=reject` that all legitimate senders for `catatia.com` pass DKIM or SPF alignment — a strict policy
plus strict alignment rejects anything that does not.

---

## 6. Sending prerequisites outside DNS

| #   | Item                   | State                                                                                                                                                     | Action                                                                                                                                                  |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SES production access  | **Both accounts are in the sandbox** (`ProductionAccessEnabled: false`): 200 emails per 24 h, 1 per second, and **recipients must be verified addresses** | Request production access per account in the SES console (use case, sending domain, opt-in handling, bounce/complaint process)                          |
| 2   | Application transport  | Mailtrap/Mailgun branches exist; the SES branch is not implemented yet (plan `014-ses-transactional-email.md`)                                            | Implement `MAIL_PROVIDER=ses`, then set `MAIL_PROVIDER=ses`, `MAIL_FROM=do-not-reply@<domain>`, `SES_REGION=<region>` on Vercel                         |
| 3   | Sending credentials    | The app authenticates to SES with the AWS key pair of the account it sends from                                                                           | catatia: the existing user already has `ses:SendEmail`/`SendRawEmail`. Client account: the app IAM user is created by the data stack (plan 014, task 4) |
| 4   | Stale address identity | `info@catatia.com` exists as an email-address identity with status `FAILED`                                                                               | Ignore or delete; the domain identity is what sends                                                                                                     |

---

## 7. Handover summary

- `prayer365.eu` — owner: client (Elkdata DNS). Six records in section 2, then SES flips to verified.
- `catatia.com` — complete since before this document; only the DMARC duplicate (section 5) is open.
- Both accounts remain in the SES sandbox until production access is granted; until then only verified
  recipients receive mail.
