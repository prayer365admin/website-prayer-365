/*
 * Image transfer for the church directory import: fetch a public photo, verify it
 * is a real image, upload it into our bucket under the app's key convention and
 * return the checksum/size the media_assets row needs.
 */
import { createHash, randomUUID } from 'node:crypto'
import { S3_HEAD_OBJECT, S3_PUBLIC_URL, S3_PUT_OBJECT } from '../../providers/s3'

/*
 * Wikimedia answers 429 to a generic user agent (measured 2026-11-11: 27/50 URLs);
 * a descriptive UA is served normally.
 */
const USER_AGENT = 'Prayer365DirectoryBot/1.0 (+https://prayer365.eu; church directory import)'
const MIN_BYTES = 2_000
const MAX_BYTES = 15 * 1024 * 1024
const WIKI_THUMB_WIDTH = 1280
const DELAY_MS = 1_000

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wikimedia serves the camera original by default — 16 MB in one measured case,
 * which is both over the upload guard and wrong for a phone. Rewrite to the scaled
 * thumbnail that Commons already renders.
 */
export const webFriendlyUrl = (url: string): string => {
  const match = url.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i,
  )
  if (!match) return url
  const [, first, second, file] = match
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${first}/${second}/${file}/${WIKI_THUMB_WIDTH}px-${file}`
}

export interface DownloadedImage {
  bytes: Uint8Array
  mime: string
  checksum: string
  byteSize: number
}

export const fetchImage = async (url: string): Promise<DownloadedImage> => {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`IMAGE_HTTP_${res.status} ${url}`)
  const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!mime.startsWith('image/')) throw new Error(`IMAGE_NOT_IMAGE "${mime}" ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength < MIN_BYTES) throw new Error(`IMAGE_TOO_SMALL ${bytes.byteLength} ${url}`)
  if (bytes.byteLength > MAX_BYTES) throw new Error(`IMAGE_TOO_LARGE ${bytes.byteLength} ${url}`)
  return {
    bytes,
    mime,
    checksum: createHash('sha256').update(bytes).digest('hex'),
    byteSize: bytes.byteLength,
  }
}

/** Uploads under media/<churchId>/image/<uuid> — the same prefix the app writes. */
export const uploadImage = async ({
  churchId,
  image,
}: {
  churchId: string
  image: DownloadedImage
}): Promise<{ key: string; url: string | null }> => {
  const key = `media/${churchId}/image/${randomUUID()}`
  await S3_PUT_OBJECT({ key, body: image.bytes, contentType: image.mime })
  const head = await S3_HEAD_OBJECT({ key })
  if (head.contentLength !== image.byteSize) {
    throw new Error(`S3_SIZE_MISMATCH ${key} expected ${image.byteSize} got ${head.contentLength}`)
  }
  return { key, url: S3_PUBLIC_URL({ key }) }
}

/** Downloads and uploads one image, waiting between requests to stay under the rate limit. */
export const transferImage = async ({ churchId, url }: { churchId: string; url: string }) => {
  await sleep(DELAY_MS)
  const image = await fetchImage(url)
  const { key, url: publicUrl } = await uploadImage({ churchId, image })
  return { ...image, key, publicUrl }
}
