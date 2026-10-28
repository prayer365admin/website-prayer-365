'use client'

import SearchInput from '@/components/common/search-input'
import { ArrowRightTailIcon } from '@/components/icon/arrow-right-tail'
import { useAccessPermission } from '@/hooks/data/access-permission'
import {
  CentralVoiceListOptions,
  useCentralVoiceProfiles,
  useDisableVoiceProfile,
} from '@/hooks/data/voice'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { VoiceProfileListItem } from '@/models/voice'
import { VOICE_REGISTRATION_STATES, VOICE_REVIEW_STATES } from '@/utils/constant'
import { App, DatePicker, Select, Table } from 'antd'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { VoiceProfileColumns } from './columns'
import styles from './central-review.module.scss'
import { registrationLabel, reviewLabel } from './status'

type SortKey = NonNullable<CentralVoiceListOptions['orderBy']>

const selectTextStyle: CSSProperties = {
  fontFamily: 'var(--font-text)',
  fontSize: 14,
  fontStyle: 'normal',
  fontWeight: 400,
  lineHeight: '150%',
  letterSpacing: 0,
  verticalAlign: 'middle',
}

/*
 * S24 Voice Submission Review list (F4VO VO-05): filters, search, sortable
 * table (columns.tsx). Each profile opens on its own page (central-review-detail.tsx).
 */

export default function ContentsVoiceReview() {
  const { modal } = App.useApp()
  const permission = useAccessPermission()
  const canDisable = permission.updateAny('prayer_voice_profile').granted
  const { onDisable } = useDisableVoiceProfile()
  const [reviewState, setReviewState] = useState<CentralVoiceListOptions['reviewState']>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [registrationState, setRegistrationState] = useState<string>()
  const [search, setSearch] = useState<string | undefined>('')
  const [submitted, setSubmitted] = useState<{ from?: string; to?: string }>({})
  const [sort, setSort] = useState<{ orderBy: SortKey; orderDirection: 'asc' | 'desc' }>({
    orderBy: 'created_at',
    orderDirection: 'desc',
  })
  const { data, total, loading } = useCentralVoiceProfiles({
    reviewState,
    registrationState,
    search: search || undefined,
    submittedFrom: submitted.from,
    submittedTo: submitted.to,
    orderBy: sort.orderBy,
    orderDirection: sort.orderDirection,
    page,
    limit: pageSize,
  })

  const disableProfile = (profile: VoiceProfileListItem) => {
    modal.confirm({
      title: 'Disable this voice?',
      content: `Blocks new prayer audio using ${profile.pastorName}'s voice. Existing generated audio remains available.`,
      okText: 'Disable voice',
      okButtonProps: { danger: true },
      onOk: () => onDisable({ id: profile.id, version: profile.version }),
    })
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>AI Voice Profiles</h1>
        <p>
          Manage authorized liturgical voice models, biometric consent affidavits, and daily prayer
          roster assignments.
        </p>
      </header>

      <div className={styles.contentCard}>
        <div className={styles.filterBar}>
          <div className={styles.searchControl}>
            <SearchInput
              placeholder="Search pastors or parishes..."
              setValue={setSearch}
              setPage={setPage}
              setPageSize={setPageSize}
              iconPosition="prefix"
            />
          </div>
          <div className={styles.reviewControl}>
            <Select
              allowClear
              className="w-full"
              placeholder={<span style={selectTextStyle}>Admin Review</span>}
              aria-label="Filter admin review"
              value={reviewState}
              onChange={(value) => {
                setReviewState(value)
                setPage(1)
              }}
              options={VOICE_REVIEW_STATES.map((state) => ({
                label: (
                  <span style={selectTextStyle}>
                    {state === 'SUBMITTED' ? 'Pending' : reviewLabel(state)}
                  </span>
                ),
                value: state,
              }))}
            />
          </div>
          <div className={styles.registrationControl}>
            <Select
              allowClear
              className="w-full"
              placeholder={<span style={selectTextStyle}>Registration</span>}
              aria-label="Filter registration"
              value={registrationState}
              onChange={(value) => {
                setRegistrationState(value)
                setPage(1)
              }}
              options={VOICE_REGISTRATION_STATES.map((state) => ({
                label: <span style={selectTextStyle}>{registrationLabel(state)}</span>,
                value: state,
              }))}
            />
          </div>
          <div className={styles.publishedControl}>
            <DatePicker.RangePicker
              className="w-full"
              aria-label="Published date range"
              placeholder={['Published from', 'Published until']}
              allowEmpty={[true, true]}
              separator={
                <ArrowRightTailIcon
                  aria-hidden
                  style={{ color: 'var(--color-primary-900, #0E203E)', fontSize: 16 }}
                />
              }
              suffixIcon={null}
              onChange={(range) => {
                const [from, to] = range ?? []
                setSubmitted({
                  from: from?.startOf('day').toISOString(),
                  to: to?.endOf('day').toISOString(),
                })
                setPage(1)
              }}
            />
          </div>
        </div>

        <div className={styles.tableRegion}>
          <Table
            size="small"
            rowKey="id"
            columns={VoiceProfileColumns({
              canDisable,
              onDisable: disableProfile,
              page,
              pageSize,
            })}
            dataSource={data}
            loading={loading}
            scroll={{ x: 'max-content' }}
            onChange={(pagination, _filters, sorter) => {
              if (!Array.isArray(sorter)) {
                setSort(
                  sorter.order
                    ? {
                        orderBy: sorter.columnKey as SortKey,
                        orderDirection: sorter.order === 'ascend' ? 'asc' : 'desc',
                      }
                    : { orderBy: 'created_at', orderDirection: 'desc' },
                )
              }
              if (pagination.current) setPage(pagination.current)
              if (pagination.pageSize) setPageSize(pagination.pageSize)
            }}
            pagination={{
              total,
              current: page,
              pageSize,
              showSizeChanger: false,
              showLessItems: true,
              showTotal: (count, range) =>
                `Showing ${range[0]} - ${range[1]} of ${count.toLocaleString()} pastors`,
            }}
          />
        </div>
      </div>
    </section>
  )
}
