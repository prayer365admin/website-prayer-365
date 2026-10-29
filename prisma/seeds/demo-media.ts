import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * Demo media catalog.
 *
 * Every seeded media row must point at an object that EXISTS in whichever bucket
 * the environment uses (`bucket-catatia` on staging, `prayer365-prayer-365-media`
 * on a client env), because the mobile app plays the served URL verbatim — a
 * relative `/audio/...` path is unplayable there and a `demo/<key>` placeholder
 * 404s silently on the website too. So: the demo files that already ship in
 * `public/` are uploaded under one stable `demo/` prefix, and the seed rows
 * reference those keys.
 *
 * Object existence is checked with HEAD before every upload, so re-running the
 * seed is cheap and never rewrites a live object.
 */

export type DemoMediaPurpose = 'IMAGE' | 'VOICE_SAMPLE' | 'CONSENT_EVIDENCE' | 'GENERATED_AUDIO'

export interface DemoMediaFile {
  /** S3 object key the database stores. */
  key: string
  /** Source file relative to `public/`; omitted for generated documents. */
  file?: string
  /** Set instead of `file` for documents built at upload time. */
  generated?: 'consent'
  contentType: string
  purpose: DemoMediaPurpose
}

export const DEMO_AUDIO_KEYS = {
  peace: 'demo/audio/peace-in-uncertain-times.mp3',
  shepherd: 'demo/audio/shepherds-protection.mp3',
  liturgy: 'demo/audio/morning-liturgy.mp3',
  vespers: 'demo/audio/choral-vespers.mp3',
} as const

export const DEMO_IMAGE_KEYS = {
  church: 'demo/image/church.jpeg',
  stJohns: 'demo/image/st-johns-church.jpeg',
  sanctuary: 'demo/image/sanctuary-banner.webp',
  signUp: 'demo/image/sign-up-banner.jpg',
  lake: 'demo/image/viimsi-church-indoor.jpeg',
} as const

export const DEMO_VOICE_SAMPLE_KEY = 'demo/voice_sample/demo-voice-sample.mp3'
export const DEMO_CONSENT_KEY = 'demo/consent_evidence/demo-consent.pdf'

export const DEMO_MEDIA: DemoMediaFile[] = [
  {
    key: DEMO_AUDIO_KEYS.peace,
    file: 'audio/peace-in-uncertain-times.mp3',
    contentType: 'audio/mpeg',
    purpose: 'GENERATED_AUDIO',
  },
  {
    key: DEMO_AUDIO_KEYS.shepherd,
    file: 'audio/shepherds-protection.mp3',
    contentType: 'audio/mpeg',
    purpose: 'GENERATED_AUDIO',
  },
  {
    key: DEMO_AUDIO_KEYS.liturgy,
    file: 'audio/morning-liturgy.mp3',
    contentType: 'audio/mpeg',
    purpose: 'GENERATED_AUDIO',
  },
  {
    key: DEMO_AUDIO_KEYS.vespers,
    file: 'audio/choral-vespers.mp3',
    contentType: 'audio/mpeg',
    purpose: 'GENERATED_AUDIO',
  },
  {
    key: DEMO_IMAGE_KEYS.church,
    file: 'images/church.jpeg',
    contentType: 'image/jpeg',
    purpose: 'IMAGE',
  },
  {
    key: DEMO_IMAGE_KEYS.stJohns,
    file: 'images/st-johns-church.jpeg',
    contentType: 'image/jpeg',
    purpose: 'IMAGE',
  },
  {
    key: DEMO_IMAGE_KEYS.sanctuary,
    file: 'images/sanctuary-banner.webp',
    contentType: 'image/webp',
    purpose: 'IMAGE',
  },
  {
    key: DEMO_IMAGE_KEYS.signUp,
    file: 'images/sign-up-banner.jpg',
    contentType: 'image/jpeg',
    purpose: 'IMAGE',
  },
  {
    key: DEMO_IMAGE_KEYS.lake,
    file: 'images/viimsi-church-indoor.jpeg',
    contentType: 'image/jpeg',
    purpose: 'IMAGE',
  },
  {
    // The pastor's recorded consent for voice cloning, as a real PDF the admin
    // review screen can open. Content is obviously demo data.
    key: DEMO_VOICE_SAMPLE_KEY,
    file: 'audio/shepherds-protection.mp3',
    contentType: 'audio/mpeg',
    purpose: 'VOICE_SAMPLE',
  },
  {
    key: DEMO_CONSENT_KEY,
    generated: 'consent',
    contentType: 'application/pdf',
    purpose: 'CONSENT_EVIDENCE',
  },
]

const publicDir = () => fileURLToPath(new URL('../../public/', import.meta.url))

/** Minimal but valid single-page PDF (correct xref offsets) built at runtime. */
const buildConsentPdf = (): Buffer => {
  const escape = (s: string) => s.replace(/([()\\])/g, '\\$1')
  const lines = [
    'Prayer 365 - demo voice-cloning consent',
    '',
    'Pastor: Pastor Demo Tamm (Tallinn Demo Church)',
    'Purpose: synthetic narration of published prayers for the mobile app.',
    'Scope: generated prayer audio only, no other use.',
    'Recorded consent date: 2026-10-25',
    '',
    'THIS IS DEMO SEED DATA. Replace with the pastor-signed document',
    'before any production use of a cloned voice.',
  ]
  const content = [
    'BT',
    '/F1 13 Tf',
    '72 760 Td',
    '16 TL',
    ...lines.flatMap((line, i) => [
      `(${escape(line)}) Tj`,
      ...(i === lines.length - 1 ? [] : ['T*']),
    ]),
    'ET',
  ].join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

export const demoMediaBytes = (key: string): Buffer => {
  const item = DEMO_MEDIA.find((m) => m.key === key)
  if (!item) throw new Error(`demoMediaBytes: unknown key ${key}`)
  if (item.generated === 'consent') return buildConsentPdf()
  return readFileSync(`${publicDir()}${item.file}`)
}

export const demoMediaByteSize = (key: string): number => {
  const item = DEMO_MEDIA.find((m) => m.key === key)
  if (!item) throw new Error(`demoMediaByteSize: unknown key ${key}`)
  return item.generated ? buildConsentPdf().length : statSync(`${publicDir()}${item.file}`).size
}

export const demoMediaContentType = (key: string): string => {
  const item = DEMO_MEDIA.find((m) => m.key === key)
  if (!item) throw new Error(`demoMediaContentType: unknown key ${key}`)
  return item.contentType
}

const bucket = () =>
  process.env.AWS_BUCKET_NAME ?? process.env.S3_BUCKET ?? process.env.AWS_S3_BUCKET ?? ''
const region = () => process.env.AWS_REGION ?? process.env.S3_REGION ?? 'us-east-1'

const client = (): S3Client => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY
  const sessionToken = process.env.AWS_SESSION_TOKEN ?? process.env.S3_SESSION_TOKEN
  return new S3Client({
    region: region(),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } }
      : {}),
  })
}

export interface DemoMediaResult {
  key: string
  status: 'uploaded' | 'present' | 'skipped'
  url: string | null
}

/**
 * Uploads every demo object that is missing from the active bucket.
 * `SEED_SKIP_MEDIA_UPLOAD=1` (or no bucket configured) skips the network entirely —
 * used by offline runs and by the unit tests.
 */
export const ensureDemoMedia = async (): Promise<DemoMediaResult[]> => {
  const b = bucket()
  const skip = process.env.SEED_SKIP_MEDIA_UPLOAD === '1' || !b
  const results: DemoMediaResult[] = []

  for (const item of DEMO_MEDIA) {
    const url = b ? `https://${b}.s3.${region()}.amazonaws.com/${item.key}` : null
    if (skip) {
      results.push({ key: item.key, status: 'skipped', url })
      continue
    }
    let present = false
    try {
      await client().send(new HeadObjectCommand({ Bucket: b, Key: item.key }))
      present = true
    } catch {
      present = false
    }
    if (present) {
      results.push({ key: item.key, status: 'present', url })
      continue
    }
    await client().send(
      new PutObjectCommand({
        Bucket: b,
        Key: item.key,
        Body: demoMediaBytes(item.key),
        ContentType: item.contentType,
      }),
    )
    results.push({ key: item.key, status: 'uploaded', url })
  }

  return results
}
