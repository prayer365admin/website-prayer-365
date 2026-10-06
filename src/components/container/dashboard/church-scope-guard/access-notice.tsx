'use client'

import { Alert } from 'antd'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function ChurchAccessNotice() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (searchParams.get('notice') !== 'church_access_denied') return null

  const dismiss = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('notice')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Alert
      style={{ marginBottom: 16 }}
      type="warning"
      showIcon
      closable
      onClose={dismiss}
      title="You don’t have access to that church."
    />
  )
}
