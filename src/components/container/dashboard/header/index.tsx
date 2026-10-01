'use client'

import { Avatar, Dropdown, Layout, Typography, Spin } from 'antd'
import type { MenuProps } from 'antd'
import { LogoutOutlined, DownOutlined } from '@ant-design/icons'
import s from './index.module.scss'
import { signOut } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { useChurches } from '@/hooks/data/church'
const { Header } = Layout

export default function MainHeader() {
  const router = useRouter()
  const params = useParams<{ churchId?: string }>()
  const churchId = params?.churchId

  // Fetch assigned churches for the dropdown
  const { data: churches, loading: churchesLoading } = useChurches({
    queryString: ``,
    limit: 100,
    page: 1,
    orderBy: 'name',
    orderDirection: 'asc',
    enableFetch: !!churchId, // Only fetch if we're in a church context (or you could always fetch)
  })

  const currentChurch = churches?.find((c) => c.id === churchId)

  const churchMenuItems: MenuProps['items'] =
    churches?.map((c) => ({
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
        signOut()
      },
    },
  ]
  return (
    <>
      <Header className={`${s.header} !h-[70px] !bg-white !p-0`}>
        <div className="h-full w-full px-10 flex justify-between items-center">
          <div>
            {churchId && (
              <Dropdown
                menu={{ items: churchMenuItems, selectedKeys: [churchId] }}
                trigger={['click']}
              >
                <div className="flex items-center cursor-pointer gap-2">
                  <Typography.Text strong className="text-lg">
                    {churchesLoading ? <Spin size="small" /> : currentChurch?.name || 'Loading...'}
                  </Typography.Text>
                  <DownOutlined className="text-gray-500 text-xs mt-1" />
                </div>
              </Dropdown>
            )}
          </div>
          <Dropdown menu={{ items: dropdownMenu }}>
            <Avatar src="/images/icon.jpg" size={'large'} className="cursor-pointer" />
          </Dropdown>
        </div>
      </Header>
    </>
  )
}
