'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import { useCentralChurches } from '@/hooks/data/central'
import { useCentralPrayers } from '@/hooks/data/prayer'
import { useCentralVoiceProfiles } from '@/hooks/data/voice'
import { Card, Col, Row, Statistic } from 'antd'
import Link from 'next/link'

/*
 * Landing overview (plan 023). Both placeholders (`/dashboard` = "Testing page",
 * `/dashboard/central` = "Central") become a real "what needs attention" view,
 * built ONLY from endpoints that already exist. A caller whose scope cannot read
 * a card simply sees a dash there instead of a broken page, so the same component
 * is safe for a church-level admin.
 */

interface Props {
  variant: 'home' | 'central'
}

const LINKS: Record<Props['variant'], { href: string; label: string }[]> = {
  home: [
    { href: '/dashboard/churches', label: 'My churches' },
    { href: '/dashboard/central/prayers', label: 'All prayers' },
    { href: '/dashboard/central/voice-profiles', label: 'Voice profiles' },
    { href: '/dashboard/user-management/user', label: 'Staff accounts' },
  ],
  central: [
    { href: '/dashboard/central/churches', label: 'Churches' },
    { href: '/dashboard/central/pastors', label: 'Pastors' },
    { href: '/dashboard/central/hierarchy', label: 'Hierarchy' },
    { href: '/dashboard/central/countries', label: 'Countries' },
    { href: '/dashboard/central/languages', label: 'Languages' },
    { href: '/dashboard/role-assignments', label: 'Role assignments' },
    { href: '/dashboard/central/notifications', label: 'Notification rules' },
    { href: '/dashboard/central/voice-profiles', label: 'Voice profiles' },
  ],
}

export default function ContentsOverview({ variant }: Props) {
  const churches = useCentralChurches()
  const voice = useCentralVoiceProfiles({ limit: 1, reviewState: 'SUBMITTED' })
  const prayers = useCentralPrayers({ limit: 1, status: 'current' })

  const churchRows = churches.data ?? []
  const pendingChurches = churchRows.filter((church) => church.status === 'PENDING').length

  return (
    <>
      <DashboardMainHeader
        title={variant === 'home' ? 'Dashboard' : 'Central overview'}
        description="What needs attention across the platform."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Churches" value={churchRows.length} loading={churches.isLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Awaiting church approval"
              value={pendingChurches}
              loading={churches.isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Voice reviews pending" value={voice.total} loading={voice.loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Prayers to review" value={prayers.total} loading={prayers.loading} />
          </Card>
        </Col>
      </Row>

      <Card className="mt-4" title="Go to">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LINKS[variant].map((link) => (
            <li key={link.href}>
              <Link className="text-primary hover:underline" href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
