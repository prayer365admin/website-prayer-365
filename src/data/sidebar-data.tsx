import { MenuProps } from 'antd'
import { useRouter } from 'next/navigation'
import LayoutIcon from '@/components/common/layout-icon'

const DashboardItems = (router: ReturnType<typeof useRouter>): MenuProps['items'] => [
  {
    key: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutIcon name="dashboard" />,
    onClick: () => {
      router.push('/dashboard')
    },
  },
  {
    key: '/dashboard/my-voice',
    label: 'My Voice',
    icon: <LayoutIcon name="microphone" />,
    onClick: () => {
      router.push('/dashboard/my-voice')
    },
  },
  {
    key: 'churches',
    label: 'Churches',
    icon: <LayoutIcon name="church" />,
    children: [
      {
        key: '/dashboard/churches',
        label: 'My Churches',
        icon: <LayoutIcon name="church" />,
        onClick: () => {
          router.push('/dashboard/churches')
        },
      },
    ],
  },
  {
    key: 'user-management',
    label: 'User Management',
    icon: <LayoutIcon name="users" />,
    children: [
      {
        key: '/dashboard/user-management/user',
        label: 'Users',
        icon: <LayoutIcon name="users" />,
        onClick: () => {
          router.push('/dashboard/user-management/user')
        },
      },
      {
        key: '/dashboard/user-management/role',
        label: 'Roles',
        icon: <LayoutIcon name="userSettings" />,
        onClick: () => {
          router.push('/dashboard/user-management/role')
        },
      },
      {
        key: '/dashboard/customer',
        label: 'Customers',
        icon: <LayoutIcon name="customers" />,
        onClick: () => {
          router.push('/dashboard/customer')
        },
      },
    ],
  },
  {
    key: 'central',
    label: 'Central',
    icon: <LayoutIcon name="eye" />,
    children: [
      {
        key: '/dashboard/central',
        label: 'Overview',
        icon: <LayoutIcon name="eye" />,
        onClick: () => {
          router.push('/dashboard/central')
        },
      },
      {
        key: '/dashboard/central/churches',
        label: 'Churches',
        icon: <LayoutIcon name="church" />,
        onClick: () => {
          router.push('/dashboard/central/churches')
        },
      },
      {
        key: '/dashboard/central/announcements',
        label: 'Announcements',
        icon: <LayoutIcon name="announcement" />,
        onClick: () => {
          router.push('/dashboard/central/announcements')
        },
      },
      {
        key: '/dashboard/central/prayers',
        label: 'Prayers',
        icon: <LayoutIcon name="bell" />,
        onClick: () => {
          router.push('/dashboard/central/prayers')
        },
      },
      {
        key: '/dashboard/central/pastors',
        label: 'Pastors',
        icon: <LayoutIcon name="pastor" />,
        onClick: () => {
          router.push('/dashboard/central/pastors')
        },
      },
      {
        key: '/dashboard/central/hierarchy',
        label: 'Hierarchy',
        icon: <LayoutIcon name="hierarchy" />,
        onClick: () => {
          router.push('/dashboard/central/hierarchy')
        },
      },
      {
        key: '/dashboard/central/countries',
        label: 'Countries',
        icon: <LayoutIcon name="earth" />,
        onClick: () => {
          router.push('/dashboard/central/countries')
        },
      },
      {
        key: '/dashboard/central/languages',
        label: 'Languages',
        icon: <LayoutIcon name="language" />,
        onClick: () => {
          router.push('/dashboard/central/languages')
        },
      },
      {
        key: '/dashboard/central/voice-profiles',
        label: 'Voice Profiles',
        icon: <LayoutIcon name="smile" />,
        onClick: () => {
          router.push('/dashboard/central/voice-profiles')
        },
      },
      {
        key: '/dashboard/central/notifications',
        label: 'Notifications',
        icon: <LayoutIcon name="bell" />,
        onClick: () => {
          router.push('/dashboard/central/notifications')
        },
      },
    ],
  },
]

export const SidebarMenu = () => DashboardItems(useRouter())
