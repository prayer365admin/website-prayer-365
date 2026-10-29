'use client'

import SiteButton from '@/components/common/button'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { LockIcon } from '@/components/icon/lock'
import {
  RecoveryBackLink,
  RecoveryCard,
  RecoveryHeading,
  RecoveryLockMark,
  RecoveryResult,
} from '@/components/site/auth/recovery-layout'
import FormError from '@/components/site/form-error'
import { useResetPassword } from '@/hooks/data/site/password'
import { errorCodeOf } from '@/hooks/data/site/verify'
import { useSiteI18n } from '@/i18n/site-i18n'
import { Form, Input } from 'antd'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

type Values = { password: string; confirm: string }
type State = 'form' | 'done' | 'invalid'

/*
 * Reset password form (W04), from the emailed link (/reset-password?token=…).
 * Success and an invalid / expired link both replace the form with a
 * confirmation. The password change also ends existing sessions (auth_version).
 */
export default function ResetPasswordForm() {
  const { t } = useSiteI18n()
  const token = useSearchParams().get('token') ?? ''
  const [form] = Form.useForm<Values>()
  const { onReset, resetting } = useResetPassword()
  const [state, setState] = useState<State>(token ? 'form' : 'invalid')
  const [failed, setFailed] = useState(false)

  const submit = async ({ password }: Values) => {
    setFailed(false)
    try {
      await onReset({ token, password })
      setState('done')
    } catch (e) {
      const code = errorCodeOf(e)
      if (code === 'INVALID_OR_EXPIRED_TOKEN' || code === 'INVALID_TOKEN')
        return setState('invalid')
      if (code === 'INVALID_PASSWORD') {
        return form.setFields([{ name: 'password', errors: [t('signUpErrorPassword')] }])
      }
      setFailed(true)
    }
  }

  if (state === 'done') {
    return (
      <RecoveryResult
        actionHref="/login"
        actionLabel={t('recoveryLogin')}
        body={t('resetDoneBody')}
        eyebrow={t('recoveryCongratulations')}
        title={t('resetDoneTitle')}
      />
    )
  }

  if (state === 'invalid') {
    return (
      <RecoveryResult
        actionHref="/forgot-password"
        actionLabel={t('resetRequestNew')}
        body={t('resetInvalidBody')}
        status="error"
        title={t('resetInvalidTitle')}
      />
    )
  }

  return (
    <RecoveryCard>
      <RecoveryLockMark />
      <RecoveryHeading title={t('resetTitle')} />

      <Form
        className="site-form mt-8"
        disabled={resetting}
        form={form}
        layout="vertical"
        onFinish={submit}
        requiredMark={false}
        validateTrigger="onSubmit"
      >
        <Form.Item
          label={t('resetNewLabel')}
          name="password"
          rules={[
            { required: true, message: t('signUpErrorPassword') },
            { min: 8, message: t('signUpErrorPassword') },
          ]}
        >
          <Input.Password
            autoComplete="new-password"
            placeholder="••••••••••••"
            prefix={<LockIcon aria-hidden className="!text-primary-900" />}
          />
        </Form.Item>
        <Form.Item
          dependencies={['password']}
          label={t('resetConfirmLabel')}
          name="confirm"
          rules={[
            { required: true, message: t('resetMismatch') },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || value === getFieldValue('password')
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('resetMismatch'))),
            }),
          ]}
        >
          <Input.Password
            autoComplete="new-password"
            placeholder="••••••••••••"
            prefix={<LockIcon aria-hidden className="!text-primary-900" />}
          />
        </Form.Item>

        {failed && <FormError className="mb-4">{t('error')}</FormError>}

        <SiteButton
          className="w-full"
          icon={<ArrowRightIcon aria-hidden style={{ fontSize: 18 }} />}
          iconPlacement="end"
          loading={resetting}
          size="lg"
          type="submit"
        >
          {t('resetSubmit')}
        </SiteButton>

        <div className="mt-8">
          <RecoveryBackLink />
        </div>
      </Form>
    </RecoveryCard>
  )
}
