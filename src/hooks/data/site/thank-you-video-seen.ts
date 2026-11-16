'use client'

import { useCallback, useSyncExternalStore } from 'react'

const SEEN_EVENT = 'prayer365:thankyou-video-seen'

const storageKey = (sessionId: string) => `thankyou_video_${sessionId}`

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener(SEEN_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(SEEN_EVENT, onChange)
  }
}

/**
 * Whether this checkout's thank-you film was already watched in this tab.
 *
 * sessionStorage is an external store, so it is read through `useSyncExternalStore`:
 * the server snapshot is always `false` and the browser switches to the real value
 * after hydration. Deciding during render instead would paint the overlay on the
 * server and hide it in the browser — a hydration mismatch.
 */
export const useThankYouVideoSeen = (sessionId: string | null) => {
  const getSnapshot = useCallback(() => {
    if (!sessionId) return false
    try {
      return Boolean(sessionStorage.getItem(storageKey(sessionId)))
    } catch {
      return false
    }
  }, [sessionId])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Remember the film for this checkout, in this tab only. */
export const markThankYouVideoSeen = (sessionId: string) => {
  try {
    sessionStorage.setItem(storageKey(sessionId), '1')
  } catch {
    // Storage disabled: the film simply plays again on the next load.
  }
  // `storage` never fires for the tab that wrote it, so tell the subscribers.
  window.dispatchEvent(new Event(SEEN_EVENT))
}
