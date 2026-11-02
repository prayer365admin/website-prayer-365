'use client'

import SiteButton from '@/components/common/button'
import RichTextEditor from '@/components/common/rich-text-editor'
import SelectPastor from '@/components/common/select/pastor'
import UploadBox from '@/components/common/upload-box'
import { ChurchProfileOutput } from '@/models/church'
import { PrayerInput, PrayerOutput } from '@/models/prayer'
import { plainTextToRichText } from '@/utils/rich-text-plain'
import { CheckOutlined, UploadOutlined } from '@ant-design/icons'
import { Col, Form, Input, Row, Select, Upload } from 'antd'
import { FormInstance } from 'antd/es/form/hooks/useForm'
import { Dispatch, ReactNode, SetStateAction } from 'react'
import styles from '../editor.module.scss'
import { PrayerFeaturedAsset } from './types'

export default function PrayerTextTab({
  churchContext,
  churchId,
  featuredAsset,
  form,
  formDisabled,
  profile,
  saveLoading,
  saved,
  setFeaturedAsset,
  onSubmit,
}: {
  churchContext?: ReactNode
  churchId: string
  featuredAsset: PrayerFeaturedAsset
  form: FormInstance<PrayerInput>
  formDisabled: boolean
  profile?: ChurchProfileOutput
  saveLoading: boolean
  saved: PrayerOutput | null
  setFeaturedAsset: Dispatch<SetStateAction<PrayerFeaturedAsset>>
  onSubmit: (payload: PrayerInput) => Promise<void>
}) {
  return (
    <div className={styles.textPanel}>
      <Form
        className={styles.textForm}
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={
          saved?.current
            ? {
                title: saved.current.title,
                introduction: saved.current.introduction,
                pastorId: saved.current.pastorId,
                languageCode: saved.current.languageCode,
                body: saved.current.body,
              }
            : undefined
        }
      >
        {churchContext}
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: 'Title is required.' }]}
        >
          <Input disabled={formDisabled} size="large" />
        </Form.Item>
        <Form.Item label="Featured image">
          <UploadBox
            formName="featuredAssetId"
            churchId={churchId}
            purpose="IMAGE"
            disabled={formDisabled}
            upload={featuredAsset}
            setUpload={(value) => {
              const next = value as { url: string | null; assetId?: string | null }
              setFeaturedAsset({
                assetId: next.assetId ?? null,
                url: next.url,
              })
              form.setFieldValue('featuredAssetId', next.assetId ?? null)
            }}
            width="320px"
            height="180px"
          />
        </Form.Item>
        <Form.Item name="introduction" label="Introduction">
          <RichTextEditor
            ariaLabel="Introduction"
            disabled={formDisabled}
            minHeight={120}
            placeholder="Write a short introduction to the prayer"
          />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <SelectPastor
              name="pastorId"
              label="Pastor"
              churchId={churchId}
              className="prayer-form-select"
              disabled={formDisabled}
              size="large"
            />
          </Col>
          <Col span={12}>
            <Form.Item
              name="languageCode"
              label="Content language"
              rules={[{ required: true, message: 'Content language is required.' }]}
            >
              <Select
                className="prayer-form-select"
                disabled={formDisabled}
                options={(profile?.languageCodes ?? []).map((code) => ({
                  value: code,
                  label: code,
                }))}
                size="large"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="body"
          label="Full prayer text"
          rules={[{ required: true, message: 'Full prayer text is required.' }]}
        >
          <RichTextEditor
            ariaLabel="Full prayer text"
            disabled={formDisabled}
            minHeight={280}
            placeholder="Write the full prayer text"
          />
        </Form.Item>
        <div className={styles.textActions}>
          <Upload
            accept=".txt"
            disabled={formDisabled}
            showUploadList={false}
            beforeUpload={async (file) => {
              const text = await file.text()
              form.setFieldsValue({ body: plainTextToRichText(text.replace(/\r\n?/g, '\n')) })
              await form.validateFields(['body']).catch(() => undefined)
              return Upload.LIST_IGNORE
            }}
          >
            <SiteButton
              disabled={formDisabled}
              icon={<UploadOutlined aria-hidden className={styles.editorIcon} />}
              iconPlacement="end"
              size="md"
              variant="outlined"
            >
              Upload text
            </SiteButton>
          </Upload>
          <div className={styles.textActionButtons}>
            <SiteButton
              disabled={formDisabled}
              icon={<CheckOutlined aria-hidden className={styles.editorIcon} />}
              iconPlacement="end"
              loading={saveLoading}
              size="md"
              type="submit"
            >
              Save text
            </SiteButton>
          </div>
        </div>
      </Form>
    </div>
  )
}
