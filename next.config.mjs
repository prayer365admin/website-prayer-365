import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */

const nextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API: process.env.GOOGLE_MAPS_API,
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.GOOGLE_MAPS_MAP_ID,
  },
  sassOptions: {
    includePaths: [path.join(__dirname, 'styles')],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },
  /*
   * App Links / Universal Links association files (public/.well-known/*).
   *
   * The Apple file has no `.json` extension, so the content type has to be set explicitly —
   * Apple rejects anything that is not `application/json`, and the endpoint must not redirect.
   * The same two files are served by every deployment (staging and production): their content
   * names app identifiers, not a host.
   */
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'content-type', value: 'application/json' },
          { key: 'cache-control', value: 'public, max-age=300' },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'content-type', value: 'application/json' }],
      },
    ]
  },
}

export default nextConfig
