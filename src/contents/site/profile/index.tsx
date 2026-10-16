'use client'

import CardTitle from '@/components/common/card-title'
import BoxContainer from '@/components/container/boxed'
import { siteFormTheme } from '@/config/antdTheme'
import { isSiteLocale } from '@/config/site-locale'
import { useAvatarUpload } from '@/hooks/data/site/avatar'
import { useMe, useMyChurches } from '@/hooks/data/site/me'
import { useSiteI18n } from '@/i18n/site-i18n'
import { AVATAR_ALLOWED_MIME, AVATAR_MAX_BYTES } from '@/models/mobile-avatar'
import { MobileMe, MobileMyChurch } from '@/models/mobile'
import { UploadOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, App, Avatar, Button, Card, ConfigProvider, Skeleton, Upload } from 'antd'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import FormProfile, { ProfileFormValues } from './form'

/*
 * Website profile (W13 / WB-16), built like the dashboard pastor edit page:
 * Card + CardTitle, warning Alert for partial relationship saves, form below.
 * Picture uploads straight away (sign → S3 → save URL); name, language, main
 * church and follows save together. No account deletion (out of scope).
 */
export default function ContentsSiteProfile({
  initialMe,
  initialChurches,
}: {
  initialMe?: MobileMe
  initialChurches?: MobileMyChurch[]
}) {
  const { t, locale: uiLocale, setLocale } = useSiteI18n()
  const { message } = App.useApp()
  const userId = initialMe?.id
  const {
    data: me,
    loading: meLoading,
    onPatch,
    patching,
  } = useMe({
    userId,
    initialData: initialMe,
  })
  const {
    data: churches,
    loading: churchesLoading,
    onFollow,
    following,
  } = useMyChurches({
    userId,
    initialData: initialChurches,
  })
  const { onUpload, uploading } = useAvatarUpload(userId, initialMe)
  const [warning, setWarning] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const followed = churches.filter((c) => c.isFollowed && !c.isMain).map((c) => c.churchId)

  const handleSubmit = async (values: ProfileFormValues) => {
    setWarning(null)
    setFailed(false)
    try {
      // null clears the main church (SPEC §5.1); the patch keeps a single is_main.
      await onPatch({
        name: values.name,
        locale: values.locale,
        mainChurchId: values.mainChurchId ?? null,
      })
    } catch (error) {
      setFailed(true)
      throw error
    }
    setLocale(values.locale)

    // Same diff as the pastor church assignments: follow added rows, unfollow
    // removed ones (never the church just made main).
    const wanted = new Set(
      (values.follows ?? []).flatMap((row) => (row.churchId ? [row.churchId] : [])),
    )
    const results = await Promise.allSettled([
      ...Array.from(wanted)
        .filter((id) => !followed.includes(id))
        .map((churchId) => onFollow({ churchId, isFollowed: true })),
      ...followed
        .filter((id) => !wanted.has(id) && id !== values.mainChurchId)
        .map((churchId) => onFollow({ churchId, isFollowed: false })),
    ])
    const failedChanges = results.filter(({ status }) => status === 'rejected').length
    if (failedChanges > 0) {
      setWarning(t('profileFollowsFailed', { count: failedChanges }))
      return
    }
    message.success(t('profileSaved'))
  }

  const uploadPicture = (file: File) => {
    const allowed = (AVATAR_ALLOWED_MIME as readonly string[]).includes(file.type)
    if (!allowed || file.size > AVATAR_MAX_BYTES) {
      message.error(t('profilePictureError'))
      return false
    }
    onUpload(file)
      .then(() => message.success(t('profileSaved')))
      .catch(() => message.error(t('error')))
    // Never let antd Upload post the file itself.
    return false
  }

  const loading = meLoading || churchesLoading
  // User.locale is CHAR(10) in the database, so it comes back space-padded.
  const savedLocale = me?.locale?.trim()

  return (
    <BoxContainer containerClassName="py-8">
      <Card title={<CardTitle title={t('profileTitle')} />}>
        {warning && (
          <Alert
            className="mb-4"
            closable
            onClose={() => setWarning(null)}
            showIcon
            title={warning}
            type="warning"
          />
        )}
        {failed && <Alert className="mb-4" showIcon title={t('error')} type="error" />}

        {loading || !me ? (
          !loading && !me ? (
            <Alert
              description={t('profileLoadErrorBody')}
              showIcon
              title={t('profileLoadError')}
              type="error"
            />
          ) : (
            <div className="w-full lg:w-1/2">
              <Skeleton active />
            </div>
          )
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4">
              <Avatar icon={<UserOutlined />} size={80} src={me.profilePicture ?? undefined} />
              <div>
                <Upload
                  accept={AVATAR_ALLOWED_MIME.join(',')}
                  beforeUpload={uploadPicture}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />} loading={uploading}>
                    {t('profileChangePicture')}
                  </Button>
                </Upload>
                <p className="mt-1 text-xs text-neutral-500">{t('profilePictureHint')}</p>
              </div>
            </div>

            {/* Website form sizes (48px inputs and selects), as on the auth pages. */}
            <ConfigProvider theme={siteFormTheme}>
              <FormProfile
                email={me.email}
                initialValues={{
                  name: me.name,
                  locale: isSiteLocale(savedLocale) ? savedLocale : uiLocale,
                  mainChurchId: me.mainChurchId,
                  follows: followed.map((churchId) => ({ churchId })),
                }}
                knownChurches={churches.map((c) => ({
                  id: c.churchId,
                  name: c.churchName,
                  city: c.city,
                }))}
                loading={patching || following}
                onSubmit={handleSubmit}
              />
            </ConfigProvider>

            <Button className="mt-8" danger onClick={() => signOut({ callbackUrl: '/login' })}>
              {t('signOut')}
            </Button>
          </>
        )}
      </Card>
    </BoxContainer>
  )
}
