import { CORS_HEADERS, CORS_METHODS, resolveCorsHeaders } from '@/utils/cors'
import { isMaintenanceEnabled } from '@/utils/maintenance'
import { NextRequest, NextResponse } from 'next/server'

/*
 * One proxy, two jobs:
 *   1. /api/*   — CORS headers (and the preflight answer).
 *   2. pages    — the maintenance switch (NEXT_PUBLIC_IS_MAINTENANCE).
 *
 * While the switch is on every page request goes to /maintenance, except four
 * paths that stay open:
 *   - /maintenance  the screen itself, or it would redirect to itself
 *   - /admin        staff keep working; the dashboard is not the public surface
 *   - /dashboard    where staff land after sign-in (the actual dashboard)
 *   - /login        staff need the door to /admin
 * API routes, Next internals (_next/*) and anything naming a file (icons,
 * images, robots.txt, .well-known) are outside the matcher, so the API, the
 * mobile app, webhooks and assets behave exactly as today — the switch takes
 * the website down, not the platform.
 *
 * The flag is a public variable baked into the build: flip it and redeploy
 * (restart `next dev` locally) to see the change.
 */
const OPEN_PATHS = ['/maintenance', '/admin', '/dashboard', '/login']

const isOpenPath = (pathname: string) =>
  OPEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/api')) {
    if (isMaintenanceEnabled() && !isOpenPath(pathname)) {
      return NextResponse.redirect(new URL('/maintenance', req.url))
    }
    return NextResponse.next()
  }

  const cors = resolveCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    if (!cors) return new NextResponse(null, { status: 204 })
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': CORS_METHODS,
        'Access-Control-Allow-Headers': CORS_HEADERS,
        'Access-Control-Max-Age': '600',
      },
    })
  }

  const res = NextResponse.next()
  if (cors) {
    for (const [key, value] of Object.entries(cors)) {
      res.headers.set(key, value)
    }
  }
  return res
}

export const config = {
  matcher: [
    '/api/:path*',
    // Pages only: skip /_next/* and any request that names a file.
    '/((?!api|_next/|.*\\..*).*)',
  ],
}
