'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useCentralChurchList } from '@/hooks/data/central'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { ChurchListItem } from '@/models/central-church'
import type { ChurchStatus } from '@prisma/client'
import { Alert, Col, Empty, Row, Select, Table, TablePaginationConfig } from 'antd'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CentralChurchColumns } from './columns'
import PurgeChurchModal from './purge-modal'
import { CHURCH_STATUS_LABELS } from './status'

const STATUSES = Object.keys(CHURCH_STATUS_LABELS) as ChurchStatus[]

/**
 * S15 — Church administration list. Every status is visible here (this is the
 * only screen that can see PENDING churches); the church-staff selector at
 * /dashboard/churches never does.
 */
export default function ContentsCentralChurches() {
  const [search, setSearch] = useState<string>()
  const [status, setStatus] = useState<ChurchStatus>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [purgeTarget, setPurgeTarget] = useState<ChurchListItem>()

  const router = useRouter()
  const permission = useAccessPermission()
  const canDelete =
    permission.deleteAny('prayer_church').granted || permission.deleteOwn('prayer_church').granted

  const { data, total, loading, error } = useCentralChurchList({
    page,
    limit: pageSize,
    search,
    status,
  })

  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize) setPageSize(pagination.pageSize)
  }

  return (
    <>
      <DashboardMainHeader
        title="Church administration"
        description="Create churches, place them in the hierarchy and control approval. A new church stays invisible to the public app until it is approved."
        buttonLabel="New church"
        url="/dashboard/central/churches/create"
        buttonPermissionSubject="prayer_church"
      />

      <Row justify="space-between" gutter={[8, 8]} className="mb-2">
        <Col className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
          <Select
            allowClear
            className="w-full sm:w-44"
            placeholder="Filter state"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={STATUSES.map((value) => ({ value, label: CHURCH_STATUS_LABELS[value] }))}
          />
        </Col>
        <Col xs={24} lg={8}>
          <SearchInput
            placeholder="Search church name"
            setValue={setSearch}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        </Col>
      </Row>

      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Churches could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <Table<ChurchListItem>
        rowKey="id"
        size="small"
        columns={CentralChurchColumns({
          canDelete,
          onOpen: (church) => router.push(`/dashboard/central/churches/${church.id}`),
          onPurge: setPurgeTarget,
        })}
        dataSource={data ?? []}
        loading={loading}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description="No churches found." /> }}
        onChange={(pagination) => handlePagination(pagination)}
        pagination={{ total, current: page, pageSize }}
      />

      <PurgeChurchModal church={purgeTarget} onClose={() => setPurgeTarget(undefined)} />
    </>
  )
}
