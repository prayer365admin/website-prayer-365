import fs from 'node:fs'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { GeneralError } from '@/utils/general-error'

/*
 * FCM transport (F12). Worker-only: never imported by a Next route, so the web
 * bundle does not carry firebase-admin.
 *
 * Credential: FIREBASE_SERVICE_ACCOUNT (service-account JSON) from Secrets
 * Manager, or FIREBASE_SERVICE_ACCOUNT_FILE pointing at the downloaded .json —
 * the local-dev form the seeding CLI also accepts.
 */

let app: App | null = null

/** Raw service-account JSON: inline value wins, then the file path. */
const serviceAccountJson = (): string | undefined => {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT
  if (inline) return inline
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE
  return file ? fs.readFileSync(file, 'utf8') : undefined
}

const firebaseApp = (): App => {
  if (app) return app
  const raw = serviceAccountJson()
  if (!raw) {
    throw new GeneralError({
      code: 500,
      error: 'CONFIG_ERROR',
      error_code: 'FIREBASE_SERVICE_ACCOUNT_MISSING',
      details: 'Firebase service account is not configured.',
    })
  }
  let credential: object
  try {
    credential = JSON.parse(raw)
  } catch {
    // A path pasted into FIREBASE_SERVICE_ACCOUNT, or a truncated key.
    throw new GeneralError({
      code: 500,
      error: 'CONFIG_ERROR',
      error_code: 'FIREBASE_SERVICE_ACCOUNT_INVALID',
      details: 'Firebase service account is not valid JSON.',
    })
  }
  app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(credential) })
  return app
}

export interface PushMessage {
  token: string
  title: string
  body: string
  data: Record<string, string>
}

export interface PushResult {
  token: string
  ok: boolean
  messageId?: string
  errorCode?: string
  invalidToken: boolean
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

/** One batch (max 500). Per-token outcomes; never throws for a single bad token. */
export const SEND_PUSH_BATCH = async (messages: PushMessage[]): Promise<PushResult[]> => {
  if (messages.length === 0) return []
  if (messages.length > 500) throw new Error('Push batch exceeds 500 tokens')
  const response = await getMessaging(firebaseApp()).sendEachForMulticast({
    tokens: messages.map((m) => m.token),
    notification: { title: messages[0].title, body: messages[0].body },
    data: messages[0].data,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  })
  return response.responses.map((r, i) => ({
    token: messages[i].token,
    ok: r.success,
    messageId: r.messageId,
    errorCode: r.error?.code,
    invalidToken: !!r.error?.code && INVALID_TOKEN_CODES.has(r.error.code),
  }))
}
