'use client'

import CardTitle from '@/components/common/card-title'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useHierarchy, useRoleAssignments } from '@/hooks/data/central'
import { useRoles } from '@/hooks/data/role'
import { HierarchyNode } from '@/models/hierarchy'
import { RoleAssignmentSummary } from '@/models/role-assignment'
import { Button, Card, Form, Modal, Popconfirm, Select, Table, TreeSelect } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'

/*
 * Church/region tenancy grants (SPEC §3.2 Layer 2) for one staff user.
 * Separate from the user's single identity role; the server enforces the
 * escalation ceiling and revocation takes effect on the next request.
 */

type GrantValues = { roleKey: string; orgNodeId: string }

const toTreeSelect = (nodes: HierarchyNode[]): Array<Record<string, unknown>> =>
  nodes.map((n) => ({
    value: n.id,
    title: `${n.name} (${n.kind.toLowerCase()})`,
    children: toTreeSelect(n.children),
  }))

export default function ScopeAssignments({ userId }: { userId: string }) {
  const permission = useAccessPermission()
  const canRead = permission.readAny('prayer_role_assignment').granted
  const canGrant = permission.createAny('prayer_role_assignment').granted
  const canRevoke = permission.deleteAny('prayer_role_assignment').granted

  const { data, loading, saving, onCreate, onRevoke } = useRoleAssignments({
    userId,
    enableFetch: canRead && Boolean(userId),
  })
  const { data: tree } = useHierarchy(canGrant)
  const { data: roles } = useRoles({ enableFetch: canGrant })
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<GrantValues>()

  if (!canRead) return null

  const submit = async (values: GrantValues) => {
    await onCreate({ userId, ...values })
    form.resetFields()
    setOpen(false)
  }

  const columns: ColumnsType<RoleAssignmentSummary> = [
    { key: 'role', title: 'Role', dataIndex: 'role_key' },
    { key: 'node', title: 'Scope', dataIndex: 'org_node_name' },
    {
      key: 'granted',
      title: 'Granted',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    ...(canRevoke
      ? [
          {
            key: 'actions',
            title: '',
            render: (_: unknown, row: RoleAssignmentSummary) => (
              <Popconfirm
                title="Revoke this assignment?"
                description="The user loses this scope on their next request."
                okText="Revoke"
                okButtonProps={{ danger: true }}
                onConfirm={() => onRevoke(row.id)}
              >
                <Button size="small" danger>
                  Revoke
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ]

  return (
    <Card
      className="mt-4"
      title={<CardTitle title="Scope Assignments" />}
      extra={
        canGrant && (
          <Button type="primary" onClick={() => setOpen(true)}>
            Grant scope
          </Button>
        )
      }
    >
      <p className="!mt-0 text-gray-500">
        Churches and regions this user may operate on. Grants never include private-request access
        unless the role itself grants it.
      </p>
      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
      />

      <Modal
        title="Grant scope"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Grant"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="roleKey" label="Role" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={(roles ?? []).map((r) => ({ label: r.name, value: r.name }))}
            />
          </Form.Item>
          <Form.Item name="orgNodeId" label="Scope" rules={[{ required: true }]}>
            <TreeSelect
              treeDefaultExpandAll
              showSearch
              treeNodeFilterProp="title"
              treeData={toTreeSelect(tree ?? [])}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
