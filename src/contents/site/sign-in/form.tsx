'use client'

import SiteButton from '@/components/common/button'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { LockIcon } from '@/components/icon/lock'
import FormError from '@/components/site/form-error'
import { useCredentialsSignIn } from '@/hooks/ui/credentials-sign-in'
import { useSiteI18n } from '@/i18n/site-i18n'
import { UserOutlined } from '@ant-design/icons'
import { Checkbox, Form, Input } from 'antd'
import Link from 'next/link'
import { useState } from 'react'

// Wrong email/password, no account, no password set: one message, so the
// form never reveals whether an email is registered.
const CREDENTIAL_CODES = ['PASSWORD_INVALID', 'USER_NOT_FOUND', 'ACCOUNT_HAS_NO_PASSWORD']

type SignInValues = { email: string; password: string; remember: boolean }

/*
 * The only client part of the sign-in page (W01): fields, error and submit.
 * The rest of the page renders on the server (see ./index.tsx).
 */
export default function SignInForm() {
  const { t } = useSiteI18n()
  const [form] = Form.useForm<SignInValues>()
  const { onSignIn, loading } = useCredentialsSignIn('/')
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const handleSubmit = async ({ email, password }: SignInValues) => {
    setErrorCode(await onSignIn({ email: email.trim(), password }))
  }

  return (
    <Form
      className="site-form"
      // Lock the fields while signing in.
      disabled={loading}
      form={form}
      initialValues={{ remember: true }}
      layout="vertical"
      onFinish={handleSubmit}
      onValuesChange={() => setErrorCode(null)}
      requiredMark={false}
      // Required messages appear only after a submit, not while typing.
      validateTrigger="onSubmit"
    >
      <Form.Item
        label={t('signInIdentifierLabel')}
        name="email"
        rules={[{ required: true, whitespace: true, message: t('signInIdentifierRequired') }]}
      >
        <Input
          autoComplete="username"
          placeholder={t('signInIdentifierPlaceholder')}
          prefix={<UserOutlined aria-hidden className="!text-primary-900" />}
        />
      </Form.Item>
      <Form.Item
        label={t('signInPasswordLabel')}
        name="password"
        rules={[{ required: true, message: t('signInPasswordRequired') }]}
      >
        <Input.Password
          autoComplete="current-password"
          placeholder="••••••••••••"
          prefix={<LockIcon aria-hidden className="!text-primary-900" />}
        />
      </Form.Item>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Form.Item className="!mb-0" name="remember" valuePropName="checked">
          <Checkbox className="!text-neutral-600 !text-sm">{t('signInRemember')}</Checkbox>
        </Form.Item>
        <Link className="text-primary-500 font-semibold !text-sm" href="/forgot-password">
          {t('signInForgot')}
        </Link>
      </div>

      {errorCode && (
        <FormError className="mb-6">
          {CREDENTIAL_CODES.includes(errorCode) ? t('signInErrorCredentials') : t('error')}
        </FormError>
      )}

      <SiteButton
        icon={<ArrowRightIcon aria-hidden style={{ fontSize: 24 }} />}
        iconPlacement="end"
        loading={loading}
        size="lg"
        type="submit"
        className="max-md:w-full"
      >
        {t('signInSubmit')}
      </SiteButton>
    </Form>
  )
}
