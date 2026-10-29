/* eslint-disable @next/next/no-img-element */
'use client'

import LayoutIcon from '@/components/common/layout-icon'
import { SidebarMenu } from '@/data/sidebar-data'
import { ConfigProvider, Drawer, Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import s from './index.module.scss'

const { Sider } = Layout

const menuTheme = {
  token: { colorText: '#5C6370', fontFamily: 'var(--font-text)', fontSize: 14 },
  components: {
    Menu: {
      collapsedIconSize: 24,
      groupTitleColor: '#8F96A3',
      iconMarginInlineEnd: 8,
      iconSize: 24,
      itemBorderRadius: 8,
      itemColor: '#5C6370',
      itemHeight: 40,
      itemHoverBg: '#F5F7FB',
      itemHoverColor: '#2F7AD2',
      itemMarginBlock: 0,
      itemMarginInline: 0,
      itemSelectedBg: '#2F7AD2',
      itemSelectedColor: '#FFFFFF',
      subMenuItemBorderRadius: 8,
      subMenuItemSelectedColor: '#FFFFFF',
    },
  },
} satisfies Parameters<typeof ConfigProvider>[0]['theme']

interface SidebarContentProps {
  collapsed: boolean
  mobile: boolean
  onCollapse: () => void
  onMenuClick?: () => void
  sidebarMenu: MenuProps['items']
  pathname: string
  expandedOpenKeys: string[]
  collapsedOpenKeys: string[]
  setExpandedOpenKeys: (keys: string[]) => void
  setCollapsedOpenKeys: (keys: string[]) => void
}

function SidebarContent({
  collapsed,
  mobile,
  onCollapse,
  onMenuClick,
  sidebarMenu,
  pathname,
  expandedOpenKeys,
  collapsedOpenKeys,
  setExpandedOpenKeys,
  setCollapsedOpenKeys,
}: SidebarContentProps) {
  return (
    <div className={s.sidebarInner}>
      <div className={s.brandRow}>
        <div className={s.brand}>
          <img
            src={process.env.NEXT_PUBLIC_COMPANY_ICON || '/images/logo.png'}
            alt="Prayer365"
            className={s.brandIcon}
          />
          {!collapsed && (
            <div className={s.brandCopy}>
              <span className={s.brandName}>
                Prayer<span>365</span>
              </span>
              <span className={s.brandTagline}>Admin Suite</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className={s.collapseButton}
          onClick={onCollapse}
          aria-label={
            mobile ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'
          }
        >
          <LayoutIcon
            name="back"
            className={`${s.collapseIcon} ${collapsed ? s.collapseIconExpanded : ''}`}
          />
        </button>
      </div>

      <div className={s.menuScroll}>
        <ConfigProvider theme={menuTheme}>
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            items={sidebarMenu}
            className={s.menu}
            selectedKeys={[pathname]}
            openKeys={collapsed ? collapsedOpenKeys : expandedOpenKeys}
            onClick={() => onMenuClick?.()}
            onOpenChange={(keys) => {
              if (collapsed) setCollapsedOpenKeys(keys)
              else setExpandedOpenKeys(keys)
            }}
          />
        </ConfigProvider>
      </div>

      <div className={s.syncStatus} title="Cloud Sync Active">
        <span className={s.syncDot} />
        {!collapsed && (
          <>
            <span>Cloud Sync Active</span>
            <span className={s.version}>v2.4.1</span>
          </>
        )}
      </div>
    </div>
  )
}

interface SideBarProps {
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export default function SideBar({ mobileOpen = false, onMobileOpenChange }: SideBarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const sidebarMenu = SidebarMenu()
  const pathname = usePathname()
  const parentMenuKey = pathname.split('/')[2]
  const defaultOpenKeys = Array.from(
    new Set(['churches', 'user-management', 'central', parentMenuKey]),
  )
  const [expandedOpenKeys, setExpandedOpenKeys] = useState<string[]>(defaultOpenKeys)
  const [collapsedOpenKeys, setCollapsedOpenKeys] = useState<string[]>([])

  const toggleSidebar = () => {
    if (!collapsed) setCollapsedOpenKeys([])
    setCollapsed((value) => !value)
  }

  const sharedContentProps = {
    sidebarMenu,
    pathname,
    expandedOpenKeys,
    collapsedOpenKeys,
    setExpandedOpenKeys,
    setCollapsedOpenKeys,
  }

  return (
    <>
      <Sider
        collapsed={collapsed}
        className={`${s.sidebar} ${s.desktopSidebar}`}
        collapsedWidth={76}
        theme="light"
        width={280}
      >
        <SidebarContent
          {...sharedContentProps}
          collapsed={collapsed}
          mobile={false}
          onCollapse={toggleSidebar}
        />
      </Sider>

      <Drawer
        rootClassName={s.mobileDrawer}
        placement="left"
        size={280}
        open={mobileOpen}
        closable={false}
        destroyOnHidden
        onClose={() => onMobileOpenChange?.(false)}
        styles={{ body: { padding: 0 } }}
      >
        <SidebarContent
          {...sharedContentProps}
          collapsed={false}
          mobile
          onCollapse={() => onMobileOpenChange?.(false)}
          onMenuClick={() => onMobileOpenChange?.(false)}
        />
      </Drawer>
    </>
  )
}
