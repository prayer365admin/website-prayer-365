/* eslint-disable no-console -- CLI script reports the generated assets on stdout */
/**
 * Regenerates every brand asset from public/images/logo.png.
 *
 * One-shot: the outputs are committed, this only re-runs when the source logo
 * changes.  bun run brand:icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const SRC = 'public/images/logo.png'
const APP_ICONS = 'public/icons/app'

const square = (size: number) =>
  sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()

async function main() {
  mkdirSync(APP_ICONS, { recursive: true })

  // Browser tab, home screen, manifest.
  await square(512).toFile('src/app/icon.png')
  await square(180).toFile('src/app/apple-icon.png')
  await square(192).toFile(`${APP_ICONS}/icon-192.png`)
  await square(512).toFile(`${APP_ICONS}/icon-512.png`)
  await square(180).toFile(`${APP_ICONS}/apple-touch-icon.png`)

  // favicon.ico: PNG-payload ICO (Vista+), one 256px entry.
  // ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes) + the PNG bytes.
  const png = await square(256).toBuffer()
  const dir = Buffer.alloc(22)
  dir.writeUInt16LE(0, 0) // reserved
  dir.writeUInt16LE(1, 2) // type: icon
  dir.writeUInt16LE(1, 4) // image count
  // width/height 256 is encoded as 0 in the two size bytes
  dir.writeUInt16LE(1, 10) // colour planes
  dir.writeUInt16LE(32, 12) // bits per pixel
  dir.writeUInt32LE(png.length, 14) // payload size
  dir.writeUInt32LE(22, 18) // payload offset
  writeFileSync('src/app/favicon.ico', Buffer.concat([dir, png]))

  // Open Graph card 1200x630.
  const logo = readFileSync(SRC).toString('base64')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#77b4f2"/><stop offset="1" stop-color="#0b4497"/>
  </linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <image href="data:image/png;base64,${logo}" x="80" y="165" width="300" height="300"/>
  <text x="430" y="300" font-family="Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">Prayer 365</text>
  <text x="430" y="360" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#e8f1fb">Ecumenical prayer platform</text>
</svg>`
  await sharp(Buffer.from(svg)).png().toFile('public/images/og-prayer-365.png')

  console.log('brand icons written')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
