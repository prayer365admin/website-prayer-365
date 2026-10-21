'use client'

import SiteButton from '@/components/common/button'
import { TrashIcon } from '@/components/icon/trash'
import { UploadIcon } from '@/components/icon/upload'
import { VerifyIcon } from '@/components/icon/verify'
import ScriptureQuote from '@/components/site/auth/scripture-quote'
import { siteFormTheme } from '@/config/antdTheme'
import { isSiteLocale, SITE_LOCALE_NAMES, SITE_LOCALES, SiteLocale } from '@/config/site-locale'
import { useAvatarUpload } from '@/hooks/data/site/avatar'
import { useMe } from '@/hooks/data/site/me'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobileMe } from '@/models/mobile'
import { AVATAR_ALLOWED_MIME, AVATAR_MAX_BYTES } from '@/models/mobile-avatar'
import { UserOutlined } from '@ant-design/icons'
import { Alert, App, Avatar, ConfigProvider, Form, Input, Select, Skeleton, Upload } from 'antd'
import { useState } from 'react'
import s from './personal-profile.module.scss'

type PersonalProfileValues = {
  name: string
  locale: SiteLocale
}

export default function PersonalProfile({
  emailVerified,
  initialMe,
}: {
  emailVerified: boolean
  initialMe: MobileMe
}) {
  const { locale: uiLocale, setLocale, t } = useSiteI18n()
  const { message } = App.useApp()
  const [form] = Form.useForm<PersonalProfileValues>()
  const {
    data: me,
    loading,
    onPatch,
    patching,
  } = useMe({
    userId: initialMe.id,
    initialData: initialMe,
  })
  const { onUpload, uploading } = useAvatarUpload(initialMe.id, initialMe)
  const savedLocale = me?.locale?.trim()
  const locale = isSiteLocale(savedLocale) ? savedLocale : uiLocale
  const initialSavedLocale = initialMe.locale?.trim()
  const [savedValues, setSavedValues] = useState<PersonalProfileValues>(() => ({
    name: initialMe.name,
    locale: isSiteLocale(initialSavedLocale) ? initialSavedLocale : uiLocale,
  }))
  const watchedName = Form.useWatch('name', form)
  const watchedLocale = Form.useWatch('locale', form)
  const hasUnsavedChanges =
    (watchedName ?? savedValues.name) !== savedValues.name ||
    (watchedLocale ?? savedValues.locale) !== savedValues.locale

  const uploadPicture = (file: File) => {
    const allowed = (AVATAR_ALLOWED_MIME as readonly string[]).includes(file.type)
    if (!allowed || file.size > AVATAR_MAX_BYTES) {
      message.error(t('profilePictureError'))
      return false
    }
    void onUpload(file)
      .then(() => message.success(t('profileSaved')))
      .catch(() => message.error(t('error')))
    return false
  }

  const removePicture = () => {
    void onPatch({ profilePicture: null })
      .then(() => message.success(t('profileSaved')))
      .catch(() => message.error(t('error')))
  }

  const save = async (values: PersonalProfileValues) => {
    const nextValues = { name: values.name.trim(), locale: values.locale }
    try {
      await onPatch(nextValues)
      form.setFieldsValue(nextValues)
      setSavedValues(nextValues)
      setLocale(nextValues.locale)
      message.success(t('profileSaved'))
    } catch {
      message.error(t('error'))
    }
  }

  const cancelChanges = () => {
    form.setFields([
      { name: 'name', value: savedValues.name, errors: [] },
      { name: 'locale', value: savedValues.locale, errors: [] },
    ])
  }

  if (loading) {
    return (
      <article className={s.card}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </article>
    )
  }

  if (!me) {
    return (
      <Alert
        className="m-6"
        description={t('profileLoadErrorBody')}
        showIcon
        title={t('profileLoadError')}
        type="error"
      />
    )
  }

  return (
    <ConfigProvider theme={siteFormTheme}>
      <article className={s.card}>
        <header className={s.heading}>
          <h1>{t('profilePersonalTitle')}</h1>
          <p>{t('profilePersonalSubtitle')}</p>
        </header>

        <Form<PersonalProfileValues>
          className={`${s.form} site-form`}
          disabled={patching || uploading}
          form={form}
          initialValues={{ name: me.name, locale }}
          layout="vertical"
          onFinish={save}
          requiredMark={false}
          validateTrigger="onSubmit"
        >
          <section className={s.identitySection}>
            <div className={s.photoPanel}>
              <Avatar
                // Empty state matches the header account button (white user icon on primary).
                icon={me.profilePicture ? undefined : <UserOutlined />}
                shape="square"
                size={156}
                src={me.profilePicture ?? undefined}
              />
              <div className={s.photoDetails}>
                <p>{t('profilePhotoVisibility')}</p>
                <div className={s.photoActions}>
                  <Upload
                    accept={AVATAR_ALLOWED_MIME.join(',')}
                    beforeUpload={uploadPicture}
                    disabled={patching || uploading}
                    showUploadList={false}
                  >
                    <SiteButton icon={<UploadIcon aria-hidden />} loading={uploading} size="xs">
                      {t('profileChangePhoto')}
                    </SiteButton>
                  </Upload>
                  <SiteButton
                    disabled={!me.profilePicture || patching || uploading}
                    icon={<TrashIcon aria-hidden />}
                    loading={patching && Boolean(me.profilePicture)}
                    onClick={removePicture}
                    size="xs"
                    variant="outlined"
                  >
                    {t('profileRemove')}
                  </SiteButton>
                </div>
              </div>
            </div>

            <div className={s.fields}>
              <Form.Item
                className={s.emailItem}
                label={
                  <span className={s.emailLabel}>
                    <span>{t('profileEmailAddress')}</span>
                    {emailVerified && (
                      <span className={s.verified}>
                        <VerifyIcon aria-hidden />
                        {t('profileVerifiedBadge')}
                      </span>
                    )}
                  </span>
                }
              >
                <Input disabled value={me.email} />
              </Form.Item>
              <Form.Item
                label={t('profileFullName')}
                name="name"
                rules={[
                  { required: true, whitespace: true, message: t('signUpErrorName') },
                  { max: 200, message: t('signUpErrorName') },
                ]}
              >
                <Input autoComplete="name" maxLength={200} />
              </Form.Item>
              <Form.Item label={t('profilePreferredLanguage')} name="locale">
                <Select
                  options={SITE_LOCALES.map((code) => ({
                    value: code,
                    label: SITE_LOCALE_NAMES[code],
                  }))}
                />
              </Form.Item>
            </div>
          </section>

          <section className={s.spiritualHeading}>{t('profileReflectionsHeading')}</section>

          <section className={s.spiritualContent}>
            <h2>{t('profileScriptureHeading')}</h2>
            <ScriptureQuote
              className={s.scriptureQuote}
              quote={t('profileScriptureQuote')}
              reference={t('profileScriptureReference')}
            />
            <h2>{t('profileMinistryHeading')}</h2>
            <p className={s.ministryUnavailable}>{t('profileMinistryUnavailable')}</p>
          </section>

          <footer className={s.actions}>
            <SiteButton
              disabled={!hasUnsavedChanges || patching || uploading}
              onClick={cancelChanges}
              size="md"
              variant="outlined"
            >
              {t('profileCancel')}
            </SiteButton>
            <SiteButton
              disabled={!hasUnsavedChanges || uploading}
              loading={patching}
              size="md"
              type="submit"
            >
              {t('profileSaveChanges')}
            </SiteButton>
          </footer>
        </Form>
      </article>
    </ConfigProvider>
  )
}
