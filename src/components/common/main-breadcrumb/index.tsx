'use client'
import { toCapitalized } from '@/utils/capitalized'
import { Breadcrumb } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function MainBreadcrumb() {
  const pathname = usePathname()
  const pathnameList = pathname.split('/').slice(2)

  return (
    <Breadcrumb
      items={[
        { title: 'Dashboard' },
        ...pathnameList.map((item, index) => {
          const currentPath = `/dashboard/${pathnameList.slice(0, index + 1).join('/')}`
          return {
            title:
              item === 'pastors' ? (
                <Link href={currentPath}>{toCapitalized(item)}</Link>
              ) : (
                toCapitalized(item)
              ),
          }
        }),
      ]}
    />
  )
}
