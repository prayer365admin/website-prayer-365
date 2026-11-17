import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth.js JWT session cookie. The `__Secure-` prefix is the https variant, so both
 * names mean "this browser has a session".
 */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token']

/**
 * "Giving & Stewardship" opens `/donate`, the signed-in church portal (WB-41).
 * A visitor without a session cookie used to bounce to `/welcome` through the
 * `(site)` guard, which is not a giving screen. Branch before that: no session →
 * public platform giving at `/give`, session → the portal renders as always.
 *
 * Presence only, never a verdict: a stale or tampered cookie still reaches the
 * page, whose `requiredWebAuth` read (and the `(site)` layout) ends the session.
 */
export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))
  if (!hasSession && request.nextUrl.pathname === '/donate') {
    return NextResponse.redirect(new URL('/give', request.url))
  }
  return NextResponse.next()
}

export const config = { matcher: '/donate' }
