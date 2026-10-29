'use client'

import { siteFormTheme } from '@/config/antdTheme'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useAnnouncementActions, useCentralAnnouncement } from '@/hooks/data/announcement'
import { useCentralChurchList } from '@/hooks/data/central'
import { ANNOUNCEMENT_STATUS, announcementStatusLabels } from '@/utils/constant'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { Alert, Button, ConfigProvider, Drawer, Form, Input, Select, Skeleton, Switch } from 'antd'
import { useState } from 'react'

export type CentralAnnouncementEditorMode = 'create' | 'edit' | 'view'

type EditorValues = { churchId?: string; title: string; body: string; published?: boolean }

export const CENTRAL_ANNOUNCEMENT_FORM_ID = 'central-announcement-editor-form'

/**
 * Right-hand editor for the central announcements list. Create picks the church;
 * afterwards the church is fixed. The publish switch is plain form state: the
 * content is saved first, then publish/unpublish runs only when the switch
 * changed, chaining the version each step returns.
 */
export default function ContentsCentralAnnouncementEditor({
  announcementId,
  mode = announcementId ? 'edit' : 'create',
  onClose,
}: {
  announcementId?: string
  mode?: CentralAnnouncementEditorMode
  onClose: () => void
}) {
  const [form] = Form.useForm<EditorValues>()
  const [submitting, setSubmitting] = useState(false)
  const readOnly = mode === 'view'
  const creating = mode === 'create'

  const permission = useAccessPermission()
  const canPublish =
    permission.updateAny('prayer_announcement_publication').granted ||
    permission.updateOwn('prayer_announcement_publication').granted

  const { data, loading, error } = useCentralAnnouncement(announcementId ?? '')
  const { data: churches, loading: churchesLoading } = useCentralChurchList({
    limit: 100,
    enableFetch: creating,
  })
  const { publishingId, unpublishingId, onCreate, onUpdate, onPublish, onUnpublish } =
    useAnnouncementActions()

  const busy = submitting || Boolean(publishingId || unpublishingId)

  const submit = async ({ churchId, title, body, published = false }: EditorValues) => {
    if (readOnly) return
    setSubmitting(true)
    const content = { title: title.trim(), body: body.trim() }
    try {
      let current: { id: string; churchId: string; version: number; published: boolean }
      if (data) {
        current = {
          id: data.id,
          churchId: data.churchId,
          version: data.version,
          published: Boolean(data.publishedAt),
        }
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
        const created = await onCreate({ churchId: churchId ?? '', ...content })
        current = {
          id: created.id,
          churchId: created.churchId,
          version: created.version,
          published: false,
        }
      }

      if (published !== current.published) {
        const variables = {
          churchId: current.churchId,
          announcementId: current.id,
          version: current.version,
        }
        try {
          await (published ? onPublish(variables) : onUnpublish(variables))
        } catch {
          // The content is saved; keep the drawer open so the status can be retried.
          return
        }
      }
      onClose()
    } catch {
      // The data hook reports the API error. Keep the drawer open for retry.
    } finally {
      setSubmitting(false)
    }
  }

  const title = creating ? 'New announcement' : (data?.title ?? 'Announcement')

  return (
    <Drawer
      open
      onClose={onClose}
      size={640}
      placement="right"
      closeIcon={false}
      closable={false}
      mask={{ closable: !busy }}
      destroyOnHidden
      rootClassName="[&_.ant-drawer-content-wrapper]:!right-6 [&_.ant-drawer-content-wrapper]:!top-6 [&_.ant-drawer-content-wrapper]:!bottom-6 [&_.ant-drawer-content-wrapper]:!h-[calc(100vh-3rem)] [&_.ant-drawer-content-wrapper]:!max-h-[880px] [&_.ant-drawer-content-wrapper]:!my-auto [&_.ant-drawer-content-wrapper]:!p-0 [&_.ant-drawer-content-wrapper]:!shadow-none [&_.ant-drawer-content]:!rounded-2xl [&_.ant-drawer-content]:!overflow-hidden [&_.ant-drawer-content]:!shadow-2xl [&_.ant-drawer-content]:!h-full [&_.ant-drawer-content]:!bg-white [&_.ant-drawer-body]:!p-0 [&_.ant-drawer-body]:!flex [&_.ant-drawer-body]:!flex-col [&_.ant-drawer-body]:!h-full [&_.ant-drawer-body]:!overflow-hidden [&_.ant-drawer-mask]:!bg-[#0e203e]/35"
      styles={{
        wrapper: {
          boxSizing: 'border-box',
        },
        section: {
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(14, 32, 62, 0.15)',
          height: 'calc(100vh - 3rem)',
          maxHeight: 880,
          margin: 'auto 0',
        },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        },
      }}
    >
      <ConfigProvider theme={siteFormTheme}>
        <div className="flex flex-col h-full bg-white">
          <div className="box-border flex items-center justify-between gap-3 h-16 px-4 py-4 border-b border-[#dde0e4] shrink-0">
            <h2 className="text-base font-semibold text-[#0e203e] m-0 truncate">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close drawer"
              className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-[#dde0e4] bg-white text-[#0e203e] cursor-pointer p-0 hover:bg-[#fafafb] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CloseOutlined />
            </button>
          </div>

          {!creating && error ? (
            <div className="flex-1 overflow-y-auto p-4">
              <Alert
                type="error"
                showIcon
                message="Announcement could not be loaded"
                description="It may have been removed or be outside your scope. Return to the list and try again."
              />
            </div>
          ) : !creating && loading ? (
            <div className="flex-1 overflow-y-auto p-4">
              <Skeleton active />
            </div>
          ) : (
            <Form<EditorValues>
              id={CENTRAL_ANNOUNCEMENT_FORM_ID}
              form={form}
              layout="vertical"
              disabled={readOnly}
              key={data?.id ?? 'new'}
              className="flex flex-col flex-1 min-h-0"
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
              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col [&_.ant-form-item]:!mb-4">
                <Form.Item
                  label="Title"
                  name="title"
                  rules={[
                    { required: true, whitespace: true, message: 'Enter an announcement title.' },
                    { max: 500, message: 'Use 500 characters or fewer.' },
                  ]}
                >
                  <Input maxLength={500} className="!h-12" />
                </Form.Item>

                <Form.Item
                  label="Church"
                  name="churchId"
                  rules={data ? undefined : [{ required: true, message: 'Select a church.' }]}
                  extra={data ? 'The church cannot be changed after creation.' : undefined}
                >
                  {data ? (
                    <Select
                      disabled
                      options={[{ value: data.churchId, label: data.church.name }]}
                    />
                  ) : (
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Select a church"
                      loading={churchesLoading}
                      options={churches?.map((church) => ({
                        value: church.id,
                        label: church.name,
                      }))}
                    />
                  )}
                </Form.Item>

                <Form.Item
                  label="Message"
                  name="body"
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: 'Enter an announcement message.',
                    },
                    { max: 10000, message: 'Use 10000 characters or fewer.' },
                  ]}
                >
                  <Input.TextArea rows={8} maxLength={10000} showCount />
                </Form.Item>

                <Form.Item label="Publish?" name="published" valuePropName="checked">
                  <Switch
                    aria-label="Publish?"
                    disabled={!canPublish}
                    checkedChildren={announcementStatusLabels[ANNOUNCEMENT_STATUS.PUBLISHED]}
                    unCheckedChildren={announcementStatusLabels[ANNOUNCEMENT_STATUS.DRAFT]}
                  />
                </Form.Item>
              </div>
            </Form>
          )}

          <div className="box-border flex items-center justify-end gap-2 border-t border-[#f1f5f9] px-4 py-4 shrink-0">
            {readOnly ? (
              <Button
                onClick={onClose}
                disabled={busy}
                className="!bg-[#e6edfb] !text-[#2555a7] !border-transparent hover:!bg-[#d8e2f6]"
              >
                Close
              </Button>
            ) : (
              <>
                <Button
                  onClick={onClose}
                  disabled={busy}
                  className="!bg-[#e6edfb] !text-[#2555a7] !border-transparent hover:!bg-[#d8e2f6]"
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  form={CENTRAL_ANNOUNCEMENT_FORM_ID}
                  icon={<CheckOutlined />}
                  loading={submitting}
                  disabled={busy || (!creating && (loading || Boolean(error)))}
                >
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </ConfigProvider>
    </Drawer>
  )
}
