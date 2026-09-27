import { NextRequest, NextResponse } from 'next/server'
import { CORS_HEADERS, CORS_METHODS, resolveCorsHeaders } from '@/utils/cors'

export function middleware(req: NextRequest) {
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
  matcher: ['/api/:path*'],
}
