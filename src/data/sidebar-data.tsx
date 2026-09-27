import { MenuProps } from 'antd'
import { TeamOutlined, DatabaseFilled } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { useAccessPermission } from '@/hooks/data/access-permission'

export const SidebarMenu = () => {
  const router = useRouter()
  const permission = useAccessPermission()

  const sidebarMenu: MenuProps['items'] = [
    permission.read('master_data').granted
      ? {
          key: 'master-data',
          label: 'Master Data',
          icon: <DatabaseFilled />,
          children: [
            {
              key: '/dashboard/master-data/color',
              label: 'Color',
              onClick: () => {
                router.push('/dashboard/master-data/color')
              },
            },
            {
              key: '/dashboard/master-data/brand',
              label: 'Brand',
              onClick: () => {
                router.push('/dashboard/master-data/brand')
              },
            },
          ],
        }
      : null,
    permission.read('user_management').granted
      ? {
          key: 'user-management',
          label: 'User Management',
          icon: <TeamOutlined />,
          children: [
            {
              key: '/dashboard/user-management/role',
              label: 'Role',
              onClick: () => {
                router.push('/dashboard/user-management/role')
              },
            },
            {
              key: '/dashboard/user-management/user',
              label: 'User',
              onClick: () => {
                router.push('/dashboard/user-management/user')
              },
            },
          ],
        }
      : null,
  ]

  return sidebarMenu
}
