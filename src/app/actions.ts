'use server'

import { getUserById } from '@/controller/user'

export async function actionsGetUserById({ user_id }: { user_id: string }) {
  const result = getUserById({ user_id: user_id })
  return result
}
