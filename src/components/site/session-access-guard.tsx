'use client'

import { isCustomerRole } from '@/utils/customer-role'
import type { Session } from 'next-auth'
import { getSession, useSession } from 'next-auth/react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

export type SessionAccess = 'protected' | 'guest'

export const getSessionRedirect = (access: SessionAccess, session: Session | null) => {
  if (access === 'protected' && !session?.user) return '/login'
  if (access === 'guest' && session?.user && isCustomerRole(session.user.role)) return '/customer'
  return null
}

/**
 * Complements the server route guards when the browser restores a complete
 * document from its back/forward cache without requesting the route again.
 */
export default function SessionAccessGuard({ access }: { access: SessionAccess }) {
  const { data: session, status } = useSession()
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

  useLayoutEffect(() => {
    if (status === 'loading') return
    const target = getSessionRedirect(access, session)
    if (target) redirect(target)
  }, [access, redirect, session, status])

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
