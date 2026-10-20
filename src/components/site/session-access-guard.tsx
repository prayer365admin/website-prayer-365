'use client'

import { isCustomerRole } from '@/utils/customer-role'
import type { Session } from 'next-auth'
import { getSession } from 'next-auth/react'
import { useCallback, useEffect, useRef } from 'react'

export type SessionAccess = 'protected' | 'guest'

export const getSessionRedirect = (access: SessionAccess, session: Session | null) => {
  if (access === 'protected' && !session?.user) return '/login'
  if (access === 'guest' && session?.user && isCustomerRole(session.user.role)) return '/customer'
  return null
}

/**
 * Complements the server route guards when the browser restores a complete
 * document from its back/forward cache without requesting the route again.
 *
 * It deliberately does NOT redirect on a normal render: the server guards
 * (requiredWebAuth) are the only authority there. `useSession` only decodes the
 * cookie, while the server also requires an active user, so redirecting from
 * both sides ping-ponged /login <-> /customer whenever they disagreed.
 */
export default function SessionAccessGuard({ access }: { access: SessionAccess }) {
  const previousVisibility = useRef('')
  const concealed = useRef(false)

  const conceal = useCallback(() => {
    if (concealed.current) return
    previousVisibility.current = document.documentElement.style.visibility
    document.documentElement.style.visibility = 'hidden'
    concealed.current = true
  }, [])

  const reveal = useCallback(() => {
    if (!concealed.current) return
    document.documentElement.style.visibility = previousVisibility.current
    concealed.current = false
  }, [])

  const redirect = useCallback(
    (target: string) => {
      conceal()
      window.location.replace(target)
    },
    [conceal],
  )

  useEffect(() => {
    const handlePageHide = () => conceal()
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return

      void getSession()
        .then((currentSession) => {
          const target = getSessionRedirect(access, currentSession)
          if (target) redirect(target)
          else reveal()
        })
        // A failed session read must show the page, not a permanently hidden document.
        .catch(() => reveal())
    }

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
      reveal()
    }
  }, [access, conceal, redirect, reveal])

  return null
}
