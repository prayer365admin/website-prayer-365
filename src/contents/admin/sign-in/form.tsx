'use client'

import SiteButton from '@/components/common/button'
import { ArrowRightTailIcon } from '@/components/icon/arrow-right-tail'
import { LockIcon } from '@/components/icon/lock'
import { MailIcon } from '@/components/icon/mail'
import FormError from '@/components/site/form-error'
import { siteFormTheme } from '@/config/antdTheme'
import { useCredentialsSignIn } from '@/hooks/ui/credentials-sign-in'
import ConfigProvider from 'antd/es/config-provider'
import { Checkbox, Form, Input } from 'antd'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export const REMEMBER_WORKSTATION_STORAGE_KEY = 'admin_remembered_workstation_email'

const CREDENTIAL_CODES = [
  'INVALID_CREDENTIALS',
  // Keep the former codes mapped to the same copy while old server bundles drain.
  'PASSWORD_INVALID',
  'USER_NOT_FOUND',
  'ACCOUNT_HAS_NO_PASSWORD',
]

type SignInValues = {
  email: string
  password: string
  remember?: boolean
}

export default function SignInForm() {
  const [form] = Form.useForm<SignInValues>()
  const { onSignIn, loading } = useCredentialsSignIn('/dashboard')
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(REMEMBER_WORKSTATION_STORAGE_KEY)
      if (savedEmail) {
        form.setFieldsValue({
          email: savedEmail,
          remember: true,
        })
      }
    } catch {
      // Storage access may fail in restricted browsing contexts
    }
  }, [form])

  const handleSubmit = async ({ email, password, remember }: SignInValues) => {
    try {
      if (remember) {
        localStorage.setItem(REMEMBER_WORKSTATION_STORAGE_KEY, email.trim())
      } else {
        localStorage.removeItem(REMEMBER_WORKSTATION_STORAGE_KEY)
      }
    } catch {
      // Ignore storage errors
    }
    setErrorCode(await onSignIn({ email: email.trim(), password }))
  }

  return (
    <ConfigProvider theme={siteFormTheme}>
      <Form
        className="site-form"
        disabled={loading}
        form={form}
        initialValues={{ remember: false }}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={() => setErrorCode(null)}
        requiredMark={false}
        validateTrigger="onSubmit"
      >
        <Form.Item
          label="Official Church / Staff Email"
          name="email"
          rules={[{ required: true, whitespace: true, message: 'Email is required' }]}
        >
          <Input
            autoComplete="username"
            placeholder="pastor.carter@gracechurchwestminster.org"
            prefix={<MailIcon aria-hidden className="!text-[#0E203E]" />}
          />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: 'Password is required' }]}
        >
          <Input.Password
            autoComplete="current-password"
            placeholder="***********"
            prefix={<LockIcon aria-hidden className="!text-[#0E203E]" />}
          />
        </Form.Item>
        <div className="mb-4 flex items-center justify-between gap-2">
          <Form.Item className="!mb-0" name="remember" valuePropName="checked">
            <Checkbox className="text-sm text-[#5C6370]">Remember this workstation</Checkbox>
          </Form.Item>
          <Link href="/admin/forgot-password" className="text-sm font-semibold text-[#2F7AD2]">
            Forgot password?
          </Link>
        </div>

        {errorCode && (
          <FormError className="mb-4">
            {CREDENTIAL_CODES.includes(errorCode)
              ? 'Please check your email and password, and try again!'
              : 'Sign in failed. Please try again!'}
          </FormError>
        )}

        <SiteButton
          type="submit"
          size="md"
          variant="solid"
          className="!mt-6 w-full"
          icon={<ArrowRightTailIcon aria-hidden style={{ fontSize: 20 }} />}
          iconPlacement="end"
          loading={loading}
        >
          Sign In to Church Workspace
        </SiteButton>
      </Form>
    </ConfigProvider>
  )
}
