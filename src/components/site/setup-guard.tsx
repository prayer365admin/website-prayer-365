'use client'

import { SETUP_PATH, readSetupProgress, writeSetupProgress } from '@/utils/setup-progress-storage'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

/*
 * Browser-side onboarding check (WB-15) on customer pages. Once per browser:
 * with no localStorage record for the user (clean browser), it asks the
 * account, records the answer and sends an unfinished setup to
 * /customer/setup. A browser that already asked is left alone, so skipping
 * the steps is respected here and asked again in the next new browser.
 */
export default function SetupGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const userId = useSession().data?.user?.user_id

  useEffect(() => {
    if (!userId || pathname.startsWith(SETUP_PATH)) return
    if (readSetupProgress(userId)) return

    let cancelled = false
    axios
      .get('/api/v1/site/me/setup-progress')
      .then(({ data }) => {
        if (cancelled) return
        writeSetupProgress(userId, data.result)
        if (!data.result.completed) router.replace(SETUP_PATH)
      })
      .catch(() => {
        // Network / auth failure: the server guard still protects the page.
      })
    return () => {
      cancelled = true
    }
  }, [pathname, router, userId])

  return null
}
