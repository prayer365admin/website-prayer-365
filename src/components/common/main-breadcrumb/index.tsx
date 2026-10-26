'use client'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { toCapitalized } from '@/utils/capitalized'
import { Breadcrumb } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LayoutIcon from '@/components/common/layout-icon'
import s from './index.module.scss'

export default function MainBreadcrumb() {
  const pathname = usePathname()
  const permission = useAccessPermission()
  const pathnameList = pathname.split('/').slice(2)
  const canReadChurch =
    permission.readAny('prayer_church').granted || permission.readOwn('prayer_church').granted

  // /dashboard/churches (selector) and /dashboard/churches/:id (overview) both need church read.
  const isLinkable = (item: string, index: number) =>
    item === 'pastors' ||
    (canReadChurch &&
      pathnameList[0] === 'churches' &&
      index <= 1 &&
      index < pathnameList.length - 1)

  return (
    <Breadcrumb
      className={s.breadcrumb}
      items={[
        {
          title: (
            <Link href="/dashboard" aria-label="Dashboard">
              <LayoutIcon name="home" />
              <span className="sr-only">Dashboard</span>
            </Link>
          ),
        },
        ...pathnameList.map((item, index) => {
          const currentPath = `/dashboard/${pathnameList.slice(0, index + 1).join('/')}`
          return {
            title: isLinkable(item, index) ? (
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
