'use client'

import { Avatar, Dropdown, Layout } from 'antd'
import type { MenuProps } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import s from './index.module.scss'
import { signOut } from 'next-auth/react'

const { Header } = Layout

export default function MainHeader() {
  const dropdownMenu: MenuProps['items'] = [
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      onClick: () => {
        signOut()
      },
    },
  ]
  return (
    <>
      <Header className={`${s.header} !h-[70px] !bg-white !p-0`}>
        <div className="h-full w-full px-10 flex justify-end items-center">
          <Dropdown menu={{ items: dropdownMenu }}>
            <Avatar src="/images/icon.jpg" size={'large'} className="cursor-pointer" />
          </Dropdown>
        </div>
      </Header>
    </>
  )
}
