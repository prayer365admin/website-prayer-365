'use client'

import SiteButton from '@/components/common/button'
import { LockIcon } from '@/components/icon/lock'
import Confirmation from '@/components/site/auth/confirmation'
import PasswordStrength from '@/components/site/auth/password-strength'
import FormError from '@/components/site/form-error'
import { useResetPassword } from '@/hooks/data/site/password'
import { errorCodeOf } from '@/hooks/data/site/verify'
import { useSiteI18n } from '@/i18n/site-i18n'
import { Form, Input } from 'antd'
import Link from 'next/link'
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
  const password = Form.useWatch('password', form) ?? ''
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
      <Confirmation linkHref="/login" linkLabel={t('signUpSignIn')} title={t('resetDoneTitle')}>
        {t('resetDoneBody')}
      </Confirmation>
    )
  }

  if (state === 'invalid') {
    return (
      <Confirmation
        linkHref="/forgot-password"
        linkLabel={t('resetRequestNew')}
        status="error"
        title={t('resetInvalidTitle')}
      >
        {t('resetInvalidBody')}
      </Confirmation>
    )
  }

  return (
    <Form
      className="site-form"
      disabled={resetting}
      form={form}
      layout="vertical"
      onFinish={submit}
      requiredMark={false}
      validateTrigger="onSubmit"
    >
      <Form.Item
        className="!mb-2"
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
      <PasswordStrength password={password} />
      <Form.Item
        className="!mt-4"
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

      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <SiteButton
          className="w-full md:w-auto"
          desktopSize="lg"
          loading={resetting}
          size="md"
          type="submit"
        >
          {t('resetSubmit')}
        </SiteButton>
        <Link className="self-center text-sm font-semibold text-primary-500" href="/login">
          {t('signUpSuccessAction')}
        </Link>
      </div>
    </Form>
  )
}
