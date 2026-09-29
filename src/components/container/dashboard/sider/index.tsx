/* eslint-disable @next/next/no-img-element */
'use client'

import { SidebarMenu } from '@/data/sidebar-data'
import { Layout, Menu } from 'antd'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import s from './index.module.scss'

const { Sider } = Layout

export default function SideBar() {
  const [collapsed, setCollapsed] = useState<boolean>()
  const sidebarMenu = SidebarMenu()
  const pathname = usePathname()
  const parentMenuKey = pathname.split('/')[2]

  const [selectActiveKey, setActiveKey] = useState(pathname)

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={(value) => setCollapsed(value)}
      style={{ background: `${process.env.NEXT_PUBLIC_PRIMARY_COLOR}` }}
      className={`${s.sidebar}`}
      width={250}
    >
      <div className="py-5">
        <div className="w-auto h-[30px] relative flex items-center justify-center">
          {!collapsed ? (
            <img
              src={process.env.NEXT_PUBLIC_COMPANY_LOGO || '/images/logo.png'}
              alt="logo"
              className="object-contain w-auto h-full"
            />
          ) : (
            <img
              src={process.env.NEXT_PUBLIC_COMPANY_ICON || '/images/logo-white.png'}
              alt="logo"
              className="object-contain w-auto h-full px-2"
            />
          )}
        </div>
      </div>
      <Menu
        defaultSelectedKeys={['1']}
        mode="inline"
        items={sidebarMenu}
        className={`${s.menu}`}
        selectedKeys={[selectActiveKey]}
        defaultOpenKeys={[parentMenuKey]}
        onClick={(value) => {
          setActiveKey(value.keyPath[0])
        }}
      />
    </Sider>
  )
}
