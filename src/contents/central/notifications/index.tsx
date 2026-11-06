'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useNotificationRules, type NotificationRuleData } from '@/hooks/data/notification'
import {
  ALLOWED_OFFSET_MINUTES,
  ALLOWED_RECURRENCES,
  ALLOWED_RULE_TYPES,
  type NotificationRecurrence,
  type NotificationRuleType,
} from '@/models/notification'
import { Alert, Button, Col, Select, Switch, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'

/*
 * Central notification rules (F11): configuration only. Every allowed type is
 * always listed and edited inline — no create, no delete, no campaign schema.
 * `Enabled` masters a type; `Push` and `Email` gate each delivery leg, and the
 * donation reminder alone carries a calendar recurrence.
 */

const SUBJECT = 'prayer_notification_rule'

const RULE_LABELS: Record<NotificationRuleType, string> = {
  donation_reminder: 'Donation Reminder',
  prayer_published: 'Prayer Published',
  event_reminder: 'Event Reminder',
  announcement_published: 'Announcement Published',
}

const OFFSET_OPTIONS = ALLOWED_OFFSET_MINUTES.map((minutes) => ({
  value: minutes,
  label: minutes === 0 ? 'At event time' : `${minutes} minutes`,
}))

const RECURRENCE_LABELS: Record<NotificationRecurrence, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
}

const RECURRENCE_OPTIONS = ALLOWED_RECURRENCES.map((value) => ({
  value,
  label: RECURRENCE_LABELS[value],
}))

type RuleRow = {
  type: NotificationRuleType
  enabled: boolean
  push_enabled: boolean
  email_enabled: boolean
  offset_minutes: number | null
  recurrence: NotificationRecurrence | null
  version: number
}

type Draft = {
  enabled?: boolean
  push_enabled?: boolean
  email_enabled?: boolean
  offset_minutes?: number | null
  recurrence?: NotificationRecurrence | null
}

/** Types absent from GET keep their editable defaults so they can still be configured. */
const toRows = (rules: NotificationRuleData[] | undefined): RuleRow[] =>
  ALLOWED_RULE_TYPES.map((type) => {
    const rule = rules?.find((r) => r.type === type)
    return {
      type,
      enabled: rule?.enabled ?? true,
      push_enabled: rule?.push_enabled ?? true,
      email_enabled: rule?.email_enabled ?? false,
      offset_minutes: rule?.offset_minutes ?? null,
      recurrence: rule?.recurrence ?? null,
      version: rule?.version ?? 0,
    }
  })

export default function ContentsCentralNotifications() {
  const rules = useNotificationRules()
  const permission = useAccessPermission()
  const canUpdate = permission.updateAny(SUBJECT).granted

  const [drafts, setDrafts] = useState<Partial<Record<NotificationRuleType, Draft>>>({})

  const rows = useMemo(() => toRows(rules.data), [rules.data])

  // Drafts are absolute values, so a value toggled back to the server's state is not pending.
  const pending = useMemo(
    () =>
      rows
        .map((row) => ({ row, draft: drafts[row.type] ?? {} }))
        .map(({ row, draft }) => ({
          row,
          changes: {
            enabled:
              draft.enabled !== undefined && draft.enabled !== row.enabled
                ? draft.enabled
                : undefined,
            push_enabled:
              draft.push_enabled !== undefined && draft.push_enabled !== row.push_enabled
                ? draft.push_enabled
                : undefined,
            email_enabled:
              draft.email_enabled !== undefined && draft.email_enabled !== row.email_enabled
                ? draft.email_enabled
                : undefined,
            offset_minutes:
              draft.offset_minutes !== undefined && draft.offset_minutes !== row.offset_minutes
                ? draft.offset_minutes
                : undefined,
            recurrence:
              draft.recurrence !== undefined && draft.recurrence !== row.recurrence
                ? draft.recurrence
                : undefined,
          },
        }))
        .filter(({ changes }) => Object.values(changes).some((value) => value !== undefined)),
    [rows, drafts],
  )

  const draftFor = (row: RuleRow): Required<Draft> => ({
    enabled: drafts[row.type]?.enabled ?? row.enabled,
    push_enabled: drafts[row.type]?.push_enabled ?? row.push_enabled,
    email_enabled: drafts[row.type]?.email_enabled ?? row.email_enabled,
    offset_minutes: drafts[row.type]?.offset_minutes ?? row.offset_minutes,
    recurrence: drafts[row.type]?.recurrence ?? row.recurrence,
  })

  const patchDraft = (type: NotificationRuleType, patch: Draft) =>
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }))

  const submit = async () => {
    if (!pending.length) return
    // Only changed fields are sent: a rule must carry at least one of them.
    const payload = pending.map(({ row, changes }) => ({
      type: row.type,
      version: row.version,
      ...(changes.enabled !== undefined ? { enabled: changes.enabled } : {}),
      ...(changes.push_enabled !== undefined ? { push_enabled: changes.push_enabled } : {}),
      ...(changes.email_enabled !== undefined ? { email_enabled: changes.email_enabled } : {}),
      ...(changes.offset_minutes !== undefined ? { offset_minutes: changes.offset_minutes } : {}),
      ...(changes.recurrence !== undefined ? { recurrence: changes.recurrence } : {}),
    }))

    try {
      await rules.onSave(payload)
      setDrafts({})
    } catch {
      // The hook already reported the failure; keep drafts so nothing typed is lost.
    }
  }

  const columns: ColumnsType<RuleRow> = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: NotificationRuleType) => (
        <span className="font-medium text-neutral-800">{RULE_LABELS[type]}</span>
      ),
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 88,
      render: (_: unknown, row) => (
        <Switch
          aria-label={`${RULE_LABELS[row.type]} enabled`}
          checked={draftFor(row).enabled}
          disabled={!canUpdate}
          onChange={(enabled) => patchDraft(row.type, { enabled })}
        />
      ),
    },
    {
      title: 'Push',
      dataIndex: 'push_enabled',
      key: 'push_enabled',
      width: 76,
      render: (_: unknown, row) => (
        <Switch
          aria-label={`${RULE_LABELS[row.type]} push`}
          checked={draftFor(row).push_enabled}
          disabled={!canUpdate}
          onChange={(push_enabled) => patchDraft(row.type, { push_enabled })}
        />
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email_enabled',
      key: 'email_enabled',
      width: 76,
      render: (_: unknown, row) => (
        <Switch
          aria-label={`${RULE_LABELS[row.type]} email`}
          checked={draftFor(row).email_enabled}
          disabled={!canUpdate}
          onChange={(email_enabled) => patchDraft(row.type, { email_enabled })}
        />
      ),
    },
    {
      title: 'Reminder offset',
      dataIndex: 'offset_minutes',
      key: 'offset_minutes',
      render: (_: unknown, row) => (
        <Select<number>
          className="w-32"
          aria-label={`${RULE_LABELS[row.type]} reminder offset`}
          placeholder="Not set"
          allowClear
          disabled={!canUpdate}
          value={draftFor(row).offset_minutes ?? undefined}
          options={OFFSET_OPTIONS}
          onChange={(minutes) => patchDraft(row.type, { offset_minutes: minutes ?? null })}
        />
      ),
    },
    {
      title: 'Schedule',
      dataIndex: 'recurrence',
      key: 'recurrence',
      render: (_: unknown, row) =>
        row.type === 'donation_reminder' ? (
          <Select<NotificationRecurrence>
            className="w-36"
            aria-label={`${RULE_LABELS[row.type]} schedule`}
            placeholder="No schedule"
            allowClear
            disabled={!canUpdate}
            value={draftFor(row).recurrence ?? undefined}
            options={RECURRENCE_OPTIONS}
            onChange={(recurrence) => patchDraft(row.type, { recurrence: recurrence ?? null })}
          />
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      title: 'Updated version',
      dataIndex: 'version',
      key: 'version',
      align: 'right',
      width: 120,
      render: (version: number) => <span className="text-neutral-600">{version}</span>,
    },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <DashboardMainHeader
        title="Notifications"
        description="Central notification configuration (F11): enable each rule type, choose its push/email channels, reminder offset and schedule."
      >
        {canUpdate && (
          <Col>
            <Button
              type="primary"
              size="large"
              loading={rules.saving}
              disabled={!pending.length}
              onClick={submit}
            >
              Save changes
            </Button>
          </Col>
        )}
      </DashboardMainHeader>

      {rules.error ? (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Notification rules could not be loaded"
          description="Refresh the page or try again shortly."
        />
      ) : null}

      <div className="bg-white rounded-2xl border border-[#dde0e4] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] overflow-hidden [&_.ant-table]:!bg-white [&_.ant-table-thead_>_tr_>_th]:!bg-[#fafafb] [&_.ant-table-thead_>_tr_>_th]:!text-neutral-600 [&_.ant-table-thead_>_tr_>_th]:!text-xs [&_.ant-table-thead_>_tr_>_th]:!font-semibold [&_.ant-table-thead_>_tr_>_th]:!py-2 [&_.ant-table-thead_>_tr_>_th]:!px-4 [&_.ant-table-thead_>_tr_>_th]:!h-[34px] [&_.ant-table-thead_>_tr_>_th]:!border-b [&_.ant-table-thead_>_tr_>_th]:!border-[#dde0e4] [&_.ant-table-row_>_td]:!py-4 [&_.ant-table-row_>_td]:!px-4 [&_.ant-table-row_>_td]:!border-b [&_.ant-table-row_>_td]:!border-[#dde0e4]">
        <Table
          size="small"
          rowKey="type"
          columns={columns}
          dataSource={rows}
          loading={rules.loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          className="[&_.ant-table-thead_th]:!whitespace-nowrap"
        />
      </div>
    </div>
  )
}
