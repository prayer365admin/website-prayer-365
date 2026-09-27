import { MenuProps } from 'antd'
import { HomeOutlined, BankOutlined, ProjectOutlined, AudioOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'

const DashboardItems = (router: ReturnType<typeof useRouter>): MenuProps['items'] => [
  {
    key: '/dashboard',
    label: 'Dashboard',
    icon: <HomeOutlined />,
    onClick: () => {
      router.push('/dashboard')
    },
  },
  {
    key: '/dashboard/my-voice',
    label: 'My Voice',
    icon: <AudioOutlined />,
    onClick: () => {
      router.push('/dashboard/my-voice')
    },
  },
  {
    key: 'churches',
    label: 'Churches',
    icon: <BankOutlined />,
    children: [
      {
        key: '/dashboard/churches',
        label: 'My Churches',
        onClick: () => {
          router.push('/dashboard/churches')
        },
      },
    ],
  },
  {
    key: 'central',
    label: 'Central',
    icon: <ProjectOutlined />,
    children: [
      {
        key: '/dashboard/central',
        label: 'Overview',
        onClick: () => {
          router.push('/dashboard/central')
        },
      },
      {
        key: '/dashboard/central/churches',
        label: 'Churches',
        onClick: () => {
          router.push('/dashboard/central/churches')
        },
      },
      {
        key: '/dashboard/central/pastors',
        label: 'Pastors',
        onClick: () => {
          router.push('/dashboard/central/pastors')
        },
      },
      {
        key: '/dashboard/central/hierarchy',
        label: 'Hierarchy',
        onClick: () => {
          router.push('/dashboard/central/hierarchy')
        },
      },
      {
        key: '/dashboard/central/countries',
        label: 'Countries',
        onClick: () => {
          router.push('/dashboard/central/countries')
        },
      },
      {
        key: '/dashboard/central/languages',
        label: 'Languages',
        onClick: () => {
          router.push('/dashboard/central/languages')
        },
      },
      {
        key: '/dashboard/central/voice-profiles',
        label: 'Voice Profiles',
        onClick: () => {
          router.push('/dashboard/central/voice-profiles')
        },
      },
      {
        key: '/dashboard/central/notifications',
        label: 'Notifications',
        onClick: () => {
          router.push('/dashboard/central/notifications')
        },
      },
    ],
  },
]

export const SidebarMenu = () => DashboardItems(useRouter())
