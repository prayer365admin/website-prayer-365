import { getMe } from '@/controller/mobile'
import { cache } from 'react'

// The (profile) layout and the pages inside it all need the same customer
// profile record, so read it once per request (React request-scoped cache)
// instead of once per server component.
export const getMeOnce = cache((userId: string) => getMe({ userId }))
