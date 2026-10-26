'use client'

import { Badge, Button, Dropdown, Layout, Typography, Spin } from 'antd'
import type { MenuProps } from 'antd'
import { DownOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons'
import s from './index.module.scss'
import { signOut, useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { useCurrentChurch, useChurches } from '@/hooks/data/church'
import { useState } from 'react'
import MainBreadcrumb from '@/components/common/main-breadcrumb'
import LayoutIcon from '@/components/common/layout-icon'
const { Header } = Layout

export default function MainHeader({
  logoutCallbackUrl = '/admin/login',
  onMenuClick,
}: {
  logoutCallbackUrl?: string
  onMenuClick?: () => void
}) {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const params = useParams<{ churchId?: string }>()
  const churchId = params?.churchId

  // Label shares the page's cached profile read; the picker list loads on first open.
  const { data: currentChurch, loading: currentChurchLoading } = useCurrentChurch(churchId ?? '')
  const [pickerOpened, setPickerOpened] = useState(false)
  const { data: churches, loading: churchesLoading } = useChurches({
    queryString: ``,
    limit: 100,
    page: 1,
    orderBy: 'name',
    orderDirection: 'asc',
    enableFetch: !!churchId && pickerOpened,
  })

  const churchMenuItems: MenuProps['items'] = churchesLoading
    ? [{ key: 'loading', label: <Spin size="small" />, disabled: true }]
    : churches?.map((c) => ({
        key: c.id,
        label: c.name,
        onClick: () => {
          router.push(`/dashboard/churches/${c.id}`)
        },
      })) || []

  const dropdownMenu: MenuProps['items'] = [
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      onClick: () => {
        signOut({ callbackUrl: logoutCallbackUrl })
      },
    },
  ]
  const roleLabel = session?.user.role?.name
    ? session.user.role.name
        .replace(/^prayer_/, '')
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Staff'

  return (
    <Header className={s.header}>
      <div className={s.headerInner}>
        <button
          type="button"
          className={s.mobileMenuButton}
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <MenuOutlined />
        </button>
        <div className={s.headerContext}>
          <div className={s.desktopBreadcrumb}>
            <MainBreadcrumb />
          </div>
          {churchId && (
            <Dropdown
              menu={{ items: churchMenuItems, selectedKeys: [churchId] }}
              trigger={['click']}
              onOpenChange={(open) => open && setPickerOpened(true)}
            >
              <div className={s.churchPicker}>
                <Typography.Text className={s.churchName}>
                  {currentChurchLoading ? (
                    <Spin size="small" />
                  ) : (
                    currentChurch?.name || 'Select church'
                  )}
                </Typography.Text>
                <DownOutlined className={s.churchChevron} />
              </div>
            </Dropdown>
          )}
        </div>
        <div className={s.actions}>
          <Button
            type="text"
            className={s.iconButton}
            icon={<LayoutIcon name="information" />}
            aria-label="Help"
          />
          <Badge dot offset={[-5, 5]}>
            <Button
              type="text"
              className={s.iconButton}
              icon={<LayoutIcon name="bell" />}
              aria-label="Notifications"
            />
          </Badge>
          <Dropdown
            menu={{ items: dropdownMenu }}
            rootClassName={s.profileDropdown}
            trigger={['click']}
          >
            <button type="button" className={s.profileButton} aria-label="Open user menu">
              <span className={s.profileAvatar}>
                <LayoutIcon name="user" />
              </span>
              {sessionStatus === 'loading' ? (
                <span className={s.profileLoading} aria-label="Loading user profile" role="status">
                  <span className={s.profileLoadingName} />
                  <span className={s.profileLoadingRole} />
                </span>
              ) : (
                <span className={s.profileCopy}>
                  <span className={s.profileName}>{session?.user.name || 'Staff Member'}</span>
                  <span className={s.profileRole}>{roleLabel}</span>
                </span>
              )}
              <DownOutlined className={s.profileChevron} />
            </button>
          </Dropdown>
        </div>
      </div>
    </Header>
  )
}
