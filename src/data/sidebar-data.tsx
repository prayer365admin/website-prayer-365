import { MenuProps } from 'antd'
import { useRouter } from 'next/navigation'
import LayoutIcon from '@/components/common/layout-icon'
import { useAccessPermission } from '@/hooks/data/access-permission'

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

/**
 * Central menu entries gated per subject: roles without the permission never
 * see the item. Hooks must run inside a component, so filtering happens here
 * rather than inside the plain items array.
 */
const CentralGeneralPrayersItem = (router: ReturnType<typeof useRouter>): MenuProps['items'] => {
  const permission = useAccessPermission()
  const canRead =
    permission.readAny('prayer_general_prayer').granted ||
    permission.readOwn('prayer_general_prayer').granted
  if (!canRead) return []
  return [
    {
      key: '/dashboard/central/general-prayers',
      label: 'General Prayers',
      // A bible, not the praying hands: that one is the church-prayers entry, and its
      // dense artwork reads much heavier than the neighbouring outline icons.
      icon: <LayoutIcon name="bible" />,
      onClick: () => {
        router.push('/dashboard/central/general-prayers')
      },
    },
  ]
}

/**
 * The all-church donation report. It follows the donation permission and, at
 * runtime, the central scope guard: a regional admin holding the grant sees the
 * entry and the page's restricted state rather than a ledger.
 */
const CentralDonationsItem = (router: ReturnType<typeof useRouter>): MenuProps['items'] => {
  const permission = useAccessPermission()
  const canRead =
    permission.readAny('prayer_donation').granted || permission.readOwn('prayer_donation').granted
  if (!canRead) return []
  return [
    {
      key: '/dashboard/donations',
      label: 'Donations',
      // A receipt-style mark: this is a ledger report, not another prayer list.
      icon: <LayoutIcon name="verified" />,
      onClick: () => {
        router.push('/dashboard/donations')
      },
    },
  ]
}

export const SidebarMenu = () => {
  const router = useRouter()
  const items = DashboardItems(router) ?? []
  const generalPrayers = CentralGeneralPrayersItem(router) ?? []
  const donations = CentralDonationsItem(router) ?? []

  // Splice the gated entries into the central group, leaving every other entry untouched.
  return items.map((item) => {
    if (!item || !('children' in item) || item.key !== 'central') return item
    const children = item.children ?? []
    const head = children.slice(0, 3)
    const tail = children.slice(3)
    return {
      ...item,
      children: [...head, ...generalPrayers, ...donations, ...tail],
    }
  })
}
