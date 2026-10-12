import { auth } from '@/auth'
import ChurchAccessNotice from '@/components/container/dashboard/church-scope-guard/access-notice'
import { resolveListScope } from '@/controller/church'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'

/*
 * Church route guard (UX only — every API route still enforces requiredScope).
 * Resolves the caller's full church set on the server, so the check is exact
 * at any scope size and nothing renders before it passes.
 */
export default async function ChurchLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ churchId: string }>
}) {
  const { churchId } = await params
  const session = await auth()
  if (!session) redirect('/admin/login')

  const churchIds = await resolveListScope({
    userId: session.user.user_id,
    subject: 'prayer_church',
    action: 'read',
  })

  if (!churchIds.has(churchId)) {
    const [onlyChurchId] = churchIds.size === 1 ? Array.from(churchIds) : []
    const destination = onlyChurchId ? `/dashboard/churches/${onlyChurchId}` : '/dashboard/churches'
    redirect(`${destination}?notice=church_access_denied`)
  }

  return (
    <>
      <ChurchAccessNotice />
      {children}
    </>
  )
}
