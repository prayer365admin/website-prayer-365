'use client'
import { toCapitalized } from '@/utils/capitalized'
import { Breadcrumb } from 'antd'
import { usePathname } from 'next/navigation'

export default function MainBreadcrumb() {
  const pathname = usePathname()
  const pathnameList = pathname.split('/').slice(2)

  return (
    <Breadcrumb
      items={[
        { title: 'Dashboard' },
        ...pathnameList.map((item) => {
          return { title: toCapitalized(item) }
        }),
      ]}
    />
  )
}
