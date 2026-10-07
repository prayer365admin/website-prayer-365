'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { CentralVoiceListOptions, useCentralVoiceProfiles } from '@/hooks/data/voice'
import { VOICE_REGISTRATION_STATES, VOICE_REVIEW_STATES } from '@/utils/constant'
import { Card, Col, DatePicker, Row, Select, Table } from 'antd'
import { useState } from 'react'
import { VoiceProfileColumns } from './columns'
import { registrationLabel, reviewLabel } from './status'

type SortKey = NonNullable<CentralVoiceListOptions['orderBy']>

/*
 * S24 Voice Submission Review list (F4VO VO-05): filters, search, sortable
 * table (columns.tsx). Each profile opens on its own page (central-review-detail.tsx).
 */

export default function ContentsVoiceReview() {
  const [reviewState, setReviewState] = useState<CentralVoiceListOptions['reviewState']>()
  const [page, setPage] = useState(1)
  const [registrationState, setRegistrationState] = useState<string>()
  const [search, setSearch] = useState<string | undefined>('')
  const [submitted, setSubmitted] = useState<{ from?: string; to?: string }>({})
  const [sort, setSort] = useState<{ orderBy: SortKey; orderDirection: 'asc' | 'desc' }>({
    orderBy: 'created_at',
    orderDirection: 'desc',
  })
  const [pageSize, setPageSize] = useState(10)

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

  return (
    <>
      <DashboardMainHeader
        title="Voice submissions"
        description="Review pastor samples before automatic registration."
      />

      <Row justify="space-between" className="mb-2">
        <Col className="w-full lg:w-[50%] flex gap-2">
          <Select
            allowClear
            className="w-full md:w-44"
            placeholder="Admin review"
            aria-label="Filter admin review"
            value={reviewState}
            onChange={(value) => {
              setReviewState(value)
              setPage(1)
            }}
            options={VOICE_REVIEW_STATES.map((s) => ({
              label: reviewLabel(s),
              value: s,
            }))}
          />
          <Select
            allowClear
            className="w-full md:w-52"
            placeholder="Registration"
            aria-label="Filter registration"
            value={registrationState}
            onChange={(value) => {
              setRegistrationState(value)
              setPage(1)
            }}
            options={VOICE_REGISTRATION_STATES.map((s) => ({
              label: registrationLabel(s),
              value: s,
            }))}
          />
          <DatePicker.RangePicker
            aria-label="Submitted date range"
            placeholder={['Submitted from', 'Submitted until']}
            allowEmpty={[true, true]}
            onChange={(range) => {
              const [from, to] = range ?? []
              // Whole days in the viewer's time zone.
              setSubmitted({
                from: from?.startOf('day').toISOString(),
                to: to?.endOf('day').toISOString(),
              })
              setPage(1)
            }}
          />
        </Col>
        <Col className="w-full lg:w-[50%]">
          <SearchInput
            placeholder="Search pastor, church or reviewer"
            setValue={setSearch}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Table
            size="small"
            rowKey="id"
            columns={VoiceProfileColumns()}
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
            pagination={{ total, current: page, pageSize }}
          />

          <Row gutter={[16, 16]} className="mt-4">
            <Col xs={24} md={12}>
              <Card size="small" title="PRAYER ElevenLabs account">
                One platform account for all pastor voices. Only admin-approved submissions are sent
                to the provider.
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="Two separate checks">
                Admin approval permits registration. Provider readiness permits audio generation.
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </>
  )
}
