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
}

export default nextConfig
