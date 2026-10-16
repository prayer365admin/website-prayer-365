'use client'

import { SITE_LOCALE_NAMES, SITE_LOCALES, SiteLocale } from '@/config/site-locale'
import { useChurchOptions } from '@/hooks/data/site/church-option'
import { useSiteI18n } from '@/i18n/site-i18n'
import { ChurchOption } from '@/models/church-option'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Divider, Form, Input, Select, Space } from 'antd'
import { useState } from 'react'

export type ProfileFormValues = {
  name: string
  locale: SiteLocale
  mainChurchId?: string | null
  follows?: { churchId?: string }[]
}

/*
 * Website profile form (W13 / WB-16), same pattern as the dashboard pastor form
 * (FormPastor): vertical fields, a "Churches" divider, a Form.List of church
 * selects with add / remove, one Save. Email is read-only (not editable per
 * FEATURE WF1). Church selects search the public church API on the server.
 */
export default function FormProfile({
  email,
  initialValues,
  knownChurches,
  onSubmit,
  loading,
}: {
  email: string
  initialValues: ProfileFormValues
  /** Churches already linked to the user, so their names show before any search. */
  knownChurches: ChurchOption[]
  onSubmit: (values: ProfileFormValues) => Promise<void>
  loading: boolean
}) {
  const { t } = useSiteI18n()
  const [form] = Form.useForm<ProfileFormValues>()
  const [search, setSearch] = useState('')
  const { data: results, loading: searching } = useChurchOptions(search)
  const mainChurchId = Form.useWatch('mainChurchId', form)
  const follows = Form.useWatch('follows', form) ?? []

  const options = Array.from(
    new Map([...knownChurches, ...results].map((c) => [c.id, c])).values(),
  ).map((c) => ({ value: c.id, label: c.city ? `${c.name}, ${c.city}` : c.name }))

  const churchSelect = (exclude: (string | null | undefined)[]) => ({
    loading: searching,
    notFoundContent: t('signUpChurchEmpty'),
    options: options.filter((o) => !exclude.includes(o.value)),
    placeholder: t('signUpChurchPlaceholder'),
    // antd v6 search API: search the server, don't filter the loaded options.
    showSearch: { filterOption: false as const, onSearch: setSearch },
  })

  const handleSubmit = async (values: ProfileFormValues) => {
    // Same duplicate guard as FormPastor: one row per church.
    const seen = new Set<string>()
    const duplicate = (values.follows ?? []).findIndex((row) => {
      if (!row?.churchId) return false
      if (seen.has(row.churchId)) return true
      seen.add(row.churchId)
      return false
    })
    if (duplicate >= 0) {
      form.setFields([
        { name: ['follows', duplicate, 'churchId'], errors: [t('profileDuplicateChurch')] },
      ])
      return
    }
    try {
      await onSubmit({ ...values, name: values.name.trim() })
    } catch {
      // The page shows the error; keep the form for correction / retry.
    }
  }

  return (
    <div className="w-full lg:w-1/2">
      <Form<ProfileFormValues>
        className="site-form"
        disabled={loading}
        form={form}
        initialValues={initialValues}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        validateTrigger="onSubmit"
      >
        <Form.Item label={t('signUpEmailLabel')}>
          <Input disabled value={email} />
        </Form.Item>

        <Form.Item
          label={t('profileNameLabel')}
          name="name"
          rules={[
            { required: true, whitespace: true, message: t('signUpErrorName') },
            { max: 200, message: t('signUpErrorName') },
          ]}
        >
          <Input autoComplete="name" maxLength={200} />
        </Form.Item>

        <Form.Item
          label={t('language')}
          name="locale"
          rules={[{ required: true, message: t('signUpErrorLocale') }]}
        >
          <Select
            options={SITE_LOCALES.map((code) => ({ value: code, label: SITE_LOCALE_NAMES[code] }))}
          />
        </Form.Item>

        <Divider>{t('profileChurches')}</Divider>

        <Form.Item
          extra={<span className="text-xs text-neutral-500">{t('profileMainChurchHint')}</span>}
          label={t('profileMainChurch')}
          name="mainChurchId"
        >
          <Select allowClear {...churchSelect(follows.map((row) => row?.churchId))} />
        </Form.Item>

        <p className="mb-2 text-sm font-medium text-neutral-700">{t('profileFollowed')}</p>
        <Form.List name="follows">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, ...field }) => (
                <div className="mb-4 rounded-lg border border-neutral-200 p-4" key={key}>
                  <Space className="w-full" orientation="vertical" size="middle">
                    <Form.Item
                      {...field}
                      className="!mb-0"
                      label={t('profileChurch')}
                      name={[field.name, 'churchId']}
                      rules={[{ required: true, message: t('profileChurchRequired') }]}
                    >
                      <Select
                        {...churchSelect([
                          mainChurchId,
                          ...follows.filter((_, i) => i !== field.name).map((row) => row?.churchId),
                        ])}
                      />
                    </Form.Item>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                      type="text"
                    >
                      {t('profileRemoveChurch')}
                    </Button>
                  </Space>
                </div>
              ))}
              <Button block icon={<PlusOutlined />} onClick={() => add()} type="dashed">
                {t('profileAddChurch')}
              </Button>
            </>
          )}
        </Form.List>

        <Button className="mt-6" htmlType="submit" loading={loading} type="primary">
          {t('profileSave')}
        </Button>
      </Form>
    </div>
  )
}
