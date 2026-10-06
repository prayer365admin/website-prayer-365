'use client'

import CardTitle from '@/components/common/card-title'
import { AnnouncementFields } from '@/contents/churches/announcements/form'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useAnnouncementActions, useCentralAnnouncement } from '@/hooks/data/announcement'
import { useCentralChurches } from '@/hooks/data/central'
import { ANNOUNCEMENT_STATUS, announcementStatusLabels } from '@/utils/constant'
import { Alert, Button, Card, Form, Select, Skeleton, Space, Switch } from 'antd'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type DetailValues = { churchId: string; title: string; body: string; published?: boolean }

const listUrl = '/dashboard/central/announcements'

/**
 * Central create (no id) and edit (/[id]) page. The church is chosen on create
 * and fixed afterwards. The published switch is plain form state: on submit the
 * content is saved first, then publish/unpublish runs only if the switch changed,
 * chaining the version each step returns.
 */
export default function ContentsCentralAnnouncementDetail({ id }: { id?: string }) {
  const router = useRouter()
  const [form] = Form.useForm<DetailValues>()
  const [submitting, setSubmitting] = useState(false)
  const permission = useAccessPermission()
  const canUpdate =
    permission.updateAny('prayer_announcement').granted ||
    permission.updateOwn('prayer_announcement').granted
  const canPublish =
    permission.updateAny('prayer_announcement_publication').granted ||
    permission.updateOwn('prayer_announcement_publication').granted

  const { data, loading, error } = useCentralAnnouncement(id ?? '')
  const { data: churches, isLoading: churchesLoading } = useCentralChurches(!id)
  const { publishingId, unpublishingId, onCreate, onUpdate, onPublish, onUnpublish } =
    useAnnouncementActions()

  const submit = async ({ churchId, title, body, published = false }: DetailValues) => {
    setSubmitting(true)
    const content = { title: title.trim(), body: body.trim() }
    const statusChurchId = data?.churchId ?? churchId
    try {
      let current: { id: string; version: number; published: boolean }
      if (data) {
        current = { id: data.id, version: data.version, published: Boolean(data.publishedAt) }
        if (content.title !== data.title || content.body !== data.body) {
          const updated = await onUpdate({
            churchId: data.churchId,
            announcementId: data.id,
            payload: { ...content, version: data.version },
          })
          current.version = updated.version
          // An edit always returns the announcement to Draft, so the switch
          // state decides whether it is published again after saving.
          current.published = false
        }
      } else {
        const created = await onCreate({ churchId, ...content })
        current = { id: created.id, version: created.version, published: false }
      }

      if (published !== current.published) {
        const variables = {
          churchId: statusChurchId,
          announcementId: current.id,
          version: current.version,
        }
        try {
          await (published ? onPublish(variables) : onUnpublish(variables))
        } catch {
          // Content is saved; open it (create) or stay (edit) so the status can be retried.
          if (!data) router.replace(`${listUrl}/${current.id}`)
          return
        }
      }
      router.push(listUrl)
    } catch {
      // The data hook reports the API error. Keep the form for retry.
    } finally {
      setSubmitting(false)
    }
  }

  if (id && error) {
    return (
      <Card title={<CardTitle title="Announcement" />}>
        <Alert
          type="error"
          showIcon
          message="Announcement could not be loaded"
          description="It may have been removed or be outside your scope. Return to the list and try again."
        />
      </Card>
    )
  }

  const busy = submitting || Boolean(publishingId || unpublishingId)

  return (
    <Card title={<CardTitle title={id ? 'Edit Announcement' : 'Create Announcement'} />}>
      {id && loading ? (
        <Skeleton active />
      ) : (
        <Form
          key={data?.id ?? 'new'}
          form={form}
          layout="vertical"
          disabled={Boolean(id) && !canUpdate}
          initialValues={
            data
              ? {
                  churchId: data.churchId,
                  title: data.title,
                  body: data.body,
                  published: Boolean(data.publishedAt),
                }
              : { published: false }
          }
          onFinish={(values) => void submit(values)}
        >
          <Form.Item
            label="Church"
            name="churchId"
            rules={[{ required: true, message: 'Select a church.' }]}
            extra={id ? 'The church cannot be changed after creation.' : undefined}
          >
            {data ? (
              <Select disabled options={[{ value: data.churchId, label: data.church.name }]} />
            ) : (
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Select a church"
                loading={churchesLoading}
                options={churches?.map((church) => ({ value: church.id, label: church.name }))}
              />
            )}
          </Form.Item>

          <AnnouncementFields />

          <Form.Item label="Published" name="published" valuePropName="checked">
            <Switch
              aria-label="Published"
              disabled={!canPublish}
              checkedChildren={announcementStatusLabels[ANNOUNCEMENT_STATUS.PUBLISHED]}
              unCheckedChildren={announcementStatusLabels[ANNOUNCEMENT_STATUS.DRAFT]}
            />
          </Form.Item>

          <Space>
            <Button onClick={() => router.push(listUrl)} disabled={false}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting} disabled={busy}>
              {id ? 'Save changes' : 'Create announcement'}
            </Button>
          </Space>
        </Form>
      )}
    </Card>
  )
}
