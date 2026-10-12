'use client'

import { useChurchOverview } from '@/hooks/data/church'
import { ChurchOverviewAggregates } from '@/models/church'
import { Button, Card, Statistic, Typography } from 'antd'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Fragment } from 'react'
import {
  requestClassificationLabel,
  requestDetailHref,
  requestKindLabel,
} from '@/contents/churches/requests/columns'
import { ANNOUNCEMENT_STATUS, announcementStatusLabels } from '@/utils/constant'

/* Only aggregates the overview endpoint actually returns are bound to a
   number; 'Confirmed donations' has no source in ChurchOverview so it
   renders an explicit empty state. */
const METRICS: Array<{ label: string; key: keyof ChurchOverviewAggregates }> = [
  { label: 'Followers', key: 'memberCount' },
  { label: 'Prayer reads', key: 'prayerCount' },
]

export default function ContentsChurchOverview() {
  const { churchId } = useParams<{ churchId: string }>()
  const router = useRouter()
  const { data, loading } = useChurchOverview(churchId)

  const aggregates = data?.aggregates
  const requests = data?.requests

  return (
    <Fragment>
      <Typography.Title level={2}>Church overview</Typography.Title>
      <Typography.Text type="secondary">Your church at a glance.</Typography.Text>

      {/* Row 1 — metric cards */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        {METRICS.map(({ label, key }) => (
          <Card key={label} loading={loading}>
            <Statistic title={label} value={aggregates?.[key] ?? 0} />
          </Card>
        ))}
        <Card loading={loading}>
          <Statistic title="Confirmed donations" value="—" />
        </Card>
      </div>

      {/* Rows 2-3 — action cards */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Card title="Church profile" loading={loading}>
          <Typography.Text type="secondary">Manage details, location, and pastors.</Typography.Text>
          <div className="mt-3">
            <Button onClick={() => router.push(`/dashboard/churches/${churchId}/profile`)}>
              Edit profile
            </Button>
          </div>
        </Card>

        <Card title="Today's prayer" loading={loading}>
          <Typography.Text type="secondary">{aggregates?.prayerCount ?? 0} prayers</Typography.Text>
          <div className="mt-3">
            <Button onClick={() => router.push(`/dashboard/churches/${churchId}/prayers`)}>
              Open prayer
            </Button>
          </div>
        </Card>

        <Card title="Next service" loading={loading}>
          <Typography.Text type="secondary">
            {aggregates?.serviceTimeCount ?? 0} service times scheduled
          </Typography.Text>
          <div className="mt-3">
            <Button onClick={() => router.push(`/dashboard/churches/${churchId}/profile`)}>
              View schedule
            </Button>
          </div>
        </Card>

        <Card title="Upcoming events" loading={loading}>
          <Typography.Text type="secondary">{aggregates?.eventCount ?? 0} events</Typography.Text>
          <div className="mt-3">
            <Button onClick={() => router.push(`/dashboard/churches/${churchId}/events`)}>
              Open events
            </Button>
          </div>
        </Card>

        <Card title="Announcements" loading={loading}>
          <Typography.Text type="secondary">
            {aggregates?.announcementDraftCount ?? 0}{' '}
            {announcementStatusLabels[ANNOUNCEMENT_STATUS.DRAFT].toLowerCase()} •{' '}
            {aggregates?.announcementPublishedCount ?? 0}{' '}
            {announcementStatusLabels[ANNOUNCEMENT_STATUS.PUBLISHED].toLowerCase()}
          </Typography.Text>
          <div className="mt-3">
            <Button onClick={() => router.push(`/dashboard/churches/${churchId}/announcements`)}>
              Open announcements
            </Button>
          </div>
        </Card>

        {/* Server omits `requests` without prayer_request:read → section hidden */}
        {requests ? (
          <Card title="Recent requests" loading={loading}>
            <Typography.Text type="secondary">{requests.total} requests</Typography.Text>
            <ul className="mt-3 mb-3 list-disc pl-5">
              {requests.recent.map((r) => (
                <li key={r.id}>
                  <Link href={requestDetailHref(churchId, r.id)}>
                    {requestKindLabel(r.kind)} • {requestClassificationLabel(r)}
                  </Link>
                </li>
              ))}
            </ul>
            <Button onClick={() => router.push(`/dashboard/churches/${churchId}/requests`)}>
              Open requests
            </Button>
          </Card>
        ) : null}
        <Card title="Donations" loading={loading}>
          <Typography.Text type="secondary">
            Review transactions, recurring donations, and monthly totals.
          </Typography.Text>
          <div className="mt-3">
            <Button onClick={() => router.push(`/dashboard/churches/${churchId}/donations`)}>
              Open donations
            </Button>
          </div>
        </Card>
      </div>
    </Fragment>
  )
}
