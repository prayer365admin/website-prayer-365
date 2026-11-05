'use client'

import LayoutIcon, { type LayoutIconName } from '@/components/common/layout-icon'
import { useCentralChurches } from '@/hooks/data/central'
import { useChurchOverview, useChurches } from '@/hooks/data/church'
import { useCentralPrayers } from '@/hooks/data/prayer'
import {
  useCentralVoiceProfiles,
  useMyVoiceChurches,
  useMyVoiceSubmissions,
} from '@/hooks/data/voice'
import { Select } from 'antd'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'

/*
 * Three dashboards share this screen's visual language (Figma "Central Admin -
 * Index", node 40-4961), chosen by variant and role:
 * - `/dashboard` home, pastor role: the caller's own voice submissions — a
 *   pastor holds no church-wide grants, only `prayer_voice_submission` OWN.
 * - `/dashboard` home, other staff: church scope; the church is chosen in the
 *   header slot and every count belongs to it.
 * - `/dashboard/central`: platform scope, using the central endpoints.
 */

interface Props {
  variant: 'home' | 'central'
}

const TONE = {
  blue: '#2F7AD2',
  amber: '#F0B80F',
  red: '#B31A1A',
  green: '#0AC28E',
} as const

// antd 6 keeps the outlined border on the root element (no `.ant-select-selector`).
const selectClass =
  'w-full shrink-0 !h-10 sm:w-[260px] !rounded-lg !border-[#737C8C] [&_.ant-select-content]:!text-sm [&_.ant-select-content]:!text-[#393E46] [&_.ant-select-input]:!text-sm'

function KpiCard({
  label,
  value,
  loading,
  tone,
  href,
  icon,
}: {
  label: string
  value?: number
  loading: boolean
  tone: string
  href: string
  icon: LayoutIconName
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
    >
      <span className="absolute right-4 top-4" style={{ color: tone }}>
        <LayoutIcon name={icon} size={20} />
      </span>
      <span className="pr-8 font-font_text text-xs font-semibold leading-[18px] text-neutral-600">
        {label}
      </span>
      <span className="mt-2 flex items-end justify-between gap-2">
        <span className="font-font_heading text-[32px] font-bold leading-none tracking-[-1px] text-[#131B2E]">
          {loading || value === undefined ? '—' : value}
        </span>
        <span className="flex items-center gap-1 font-font_text text-xs font-semibold text-primary-500 group-hover:underline">
          View all
          <LayoutIcon name="arrowRightTail" size={20} />
        </span>
      </span>
    </Link>
  )
}

function NavigateChip({
  label,
  href,
  icon,
}: {
  label: string
  href: string
  icon: LayoutIconName
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg bg-primary-100 p-2 transition-colors hover:bg-primary-150"
    >
      <span className="grid size-11 flex-none place-items-center rounded-lg bg-primary-150 text-primary-500">
        <LayoutIcon name={icon} size={20} />
      </span>
      <span className="flex-1 font-font_text text-sm text-primary-900">{label}</span>
      <LayoutIcon className="text-primary-500" name="angleRight" size={20} />
    </Link>
  )
}

function PastorOverview() {
  const voice = useMyVoiceSubmissions()
  const churches = useMyVoiceChurches()

  const submissions = voice.data ?? []
  const countInState = (state: string) =>
    submissions.filter((submission) => submission.reviewState === state).length
  const churchLinks = churches.data.slice(0, 2)

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-font_heading text-2xl font-semibold leading-none tracking-[-1px] text-primary-900">
            Dashboard
          </h1>
          <p className="m-0 font-font_text text-sm leading-[21px] text-neutral-600">
            Your voice profiles and church assignments.
          </p>
        </div>
        <Link
          href="/dashboard/my-voice"
          className="hidden h-10 flex-none items-center rounded-lg bg-primary-500 px-3 font-font_text text-sm font-semibold text-white hover:bg-primary-700 sm:flex"
        >
          Open My Voice
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          href="/dashboard/my-voice"
          icon="microphone"
          label="My voice profiles"
          loading={voice.loading}
          tone={TONE.blue}
          value={voice.total}
        />
        <KpiCard
          href="/dashboard/my-voice"
          icon="eye"
          label="In review"
          loading={voice.loading}
          tone={TONE.amber}
          value={countInState('SUBMITTED')}
        />
        <KpiCard
          href="/dashboard/my-voice"
          icon="verified"
          label="Approved"
          loading={voice.loading}
          tone={TONE.green}
          value={countInState('APPROVED')}
        />
        <KpiCard
          href="/dashboard/my-voice"
          icon="information"
          label="Needs revision"
          loading={voice.loading}
          tone={TONE.red}
          value={countInState('REJECTED')}
        />
      </section>

      <section className="flex flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
        <header className="box-border border-b border-neutral-200 px-4 py-4">
          <h2 className="m-0 font-font_text text-base font-semibold leading-6 text-primary-900">
            Navigate to
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <NavigateChip href="/dashboard/my-voice" icon="microphone" label="My Voice" />
          <NavigateChip href="/dashboard/churches" icon="church" label="My Churches" />
          {churchLinks.map((church) => (
            <NavigateChip
              key={church.id}
              href={`/dashboard/churches/${church.id}`}
              icon="pastor"
              label={church.name}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function StaffOverview() {
  const churches = useChurches({
    queryString: '',
    limit: 100,
    page: 1,
    orderBy: 'name',
    orderDirection: 'asc',
  })
  const [selectedChurchId, setSelectedChurchId] = useState<string>()

  const churchList = churches.data ?? []
  // First accessible church by default; the header picker overrides it.
  const churchId = selectedChurchId ?? churchList[0]?.id ?? ''
  const { data: overview, loading: overviewLoading } = useChurchOverview(churchId)
  const aggregates = overview?.aggregates
  // Without a selected church every church-scoped link falls back to the list.
  const churchHref = (path: string) =>
    churchId ? `/dashboard/churches/${churchId}${path}` : '/dashboard/churches'

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-font_heading text-2xl font-semibold leading-none tracking-[-1px] text-primary-900">
            Dashboard
          </h1>
          <p className="m-0 font-font_text text-sm leading-[21px] text-neutral-600">
            Select a church assigned to your account.
          </p>
        </div>
        <Select
          className={selectClass}
          size="large"
          placeholder={churches.loading ? 'Loading churches…' : 'No churches assigned'}
          showSearch
          value={churchId || undefined}
          onChange={setSelectedChurchId}
          options={churchList.map((church) => ({ value: church.id, label: church.name }))}
          aria-label="Select church"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          href="/dashboard/churches"
          icon="church"
          label="My Churches"
          loading={churches.loading}
          tone={TONE.blue}
          value={churches.total}
        />
        <KpiCard
          href={churchHref('/prayers')}
          icon="handsPraying"
          label="Prayers"
          loading={overviewLoading}
          tone={TONE.green}
          value={aggregates?.prayerCount}
        />
        <KpiCard
          href={churchHref('/profile')}
          icon="pastor"
          label="Pastors"
          loading={overviewLoading}
          tone={TONE.amber}
          value={aggregates?.pastorCount}
        />
        <KpiCard
          href={churchHref('/announcements')}
          icon="announcement"
          label="Published announcements"
          loading={overviewLoading}
          tone={TONE.red}
          value={aggregates?.announcementPublishedCount}
        />
      </section>

      <section className="flex flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
        <header className="box-border border-b border-neutral-200 px-4 py-4">
          <h2 className="m-0 font-font_text text-base font-semibold leading-6 text-primary-900">
            Navigate to
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <NavigateChip href="/dashboard/churches" icon="church" label="My Churches" />
          <NavigateChip href="/dashboard/my-voice" icon="microphone" label="My Voice" />
          <NavigateChip href={churchHref('/profile')} icon="userSettings" label="Church profile" />
          <NavigateChip
            href="/dashboard/user-management/user"
            icon="usersSolid"
            label="Staff Accounts"
          />
        </div>
      </section>
    </div>
  )
}

function CentralOverview() {
  const churches = useCentralChurches()
  const voice = useCentralVoiceProfiles({ limit: 1, reviewState: 'SUBMITTED' })
  const prayers = useCentralPrayers({ limit: 1, status: 'current' })

  const churchRows = churches.data ?? []
  const pendingChurches = churchRows.filter((church) => church.status === 'PENDING').length

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-font_heading text-2xl font-semibold leading-none tracking-[-1px] text-primary-900">
            Central Admin
          </h1>
          <p className="m-0 font-font_text text-sm leading-[21px] text-neutral-600">
            Select a church assigned to your account.
          </p>
        </div>
        <Link
          href="/dashboard/central/churches"
          className="hidden h-10 flex-none items-center rounded-lg bg-primary-500 px-3 font-font_text text-sm font-semibold text-white hover:bg-primary-700 sm:flex"
        >
          Review church approvals
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          href="/dashboard/central/churches"
          icon="church"
          label="Churches"
          loading={churches.isLoading}
          tone={TONE.blue}
          value={churchRows.length}
        />
        <KpiCard
          href="/dashboard/central/churches?status=PENDING"
          icon="church"
          label="Awaiting Church approval"
          loading={churches.isLoading}
          tone={TONE.amber}
          value={pendingChurches}
        />
        <KpiCard
          href="/dashboard/central/voice-profiles"
          icon="smile"
          label="Voice review Pending"
          loading={voice.loading}
          tone={TONE.red}
          value={voice.total}
        />
        <KpiCard
          href="/dashboard/central/prayers"
          icon="handsPraying"
          label="Prayers to review"
          loading={prayers.loading}
          tone={TONE.green}
          value={prayers.total}
        />
      </section>

      <section className="flex flex-col rounded-2xl bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
        <header className="box-border border-b border-neutral-200 px-4 py-4">
          <h2 className="m-0 font-font_text text-base font-semibold leading-6 text-primary-900">
            Navigate to
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <NavigateChip href="/dashboard/central/churches" icon="church" label="My Church" />
          <NavigateChip href="/dashboard/central/prayers" icon="handsPraying" label="All Prayers" />
          <NavigateChip
            href="/dashboard/central/voice-profiles"
            icon="smile"
            label="Voice Profiles"
          />
          <NavigateChip
            href="/dashboard/user-management/user"
            icon="usersSolid"
            label="Staff Accounts"
          />
        </div>
      </section>
    </div>
  )
}

export default function ContentsOverview({ variant }: Props) {
  const { data: session } = useSession()
  if (variant === 'central') return <CentralOverview />
  return session?.user.role?.name === 'prayer_pastor' ? <PastorOverview /> : <StaffOverview />
}
