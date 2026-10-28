'use client'

import SiteButton, { siteButtonClassName } from '@/components/common/button'
import { ArrowRightTailIcon } from '@/components/icon/arrow-right-tail'
import { LockIcon } from '@/components/icon/lock'
import { SuccessIcon } from '@/components/icon/success'
import FormError from '@/components/site/form-error'
import { siteFormTheme } from '@/config/antdTheme'
import AuthCardHeader from '@/contents/admin/sign-in/auth-card-header'
import { useResetPassword } from '@/hooks/data/site/password'
import { errorCodeOf } from '@/hooks/data/site/verify'
import ConfigProvider from 'antd/es/config-provider'
import { Form, Input } from 'antd'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

type Values = { password: string; confirm: string }
type State = 'form' | 'done' | 'invalid'

export default function ResetPasswordForm() {
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
      if (code === 'INVALID_OR_EXPIRED_TOKEN' || code === 'INVALID_TOKEN') {
        return setState('invalid')
      }
      if (code === 'INVALID_PASSWORD') {
        return form.setFields([
          { name: 'password', errors: ['Password must be at least 8 characters'] },
        ])
      }
      setFailed(true)
    }
  }

  if (state === 'done') {
    return (
      <div className="w-full rounded-3xl border border-[#E6EDFB] bg-white p-6 sm:p-8">
        <AuthCardHeader />
        <div className="mt-8 flex flex-col items-center text-center">
          <SuccessIcon aria-hidden className="text-[#09A97C]" style={{ fontSize: 96 }} />
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[2px] text-[#2F7AD2]">
            CONGRATULATION
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-1px] text-[#0E203E]">
            Password has been reset
          </h2>
          <p className="mt-2 text-sm text-[#5C6370]">
            You can now login to your account using the new password.
          </p>
          <div className="mt-8 w-full">
            <Link
              href="/admin/login"
              className={siteButtonClassName({
                variant: 'solid',
                size: 'md',
                asLink: true,
                className: 'w-full',
              })}
            >
              Login
              <ArrowRightTailIcon aria-hidden style={{ fontSize: 20 }} />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div className="w-full rounded-3xl border border-[#E6EDFB] bg-white p-6 sm:p-8">
        <AuthCardHeader />
        <div className="mt-8 flex flex-col items-center text-center">
          <span className="mx-auto flex size-24 items-center justify-center rounded-full border-2 border-[#DF2020] text-4xl text-[#DF2020]">
            ✕
          </span>
          <h2 className="mt-6 text-2xl font-semibold tracking-[-1px] text-[#0E203E]">
            Reset link is invalid
          </h2>
          <p className="mt-2 text-sm text-[#5C6370]">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <div className="mt-8 w-full">
            <Link
              href="/admin/forgot-password"
              className={siteButtonClassName({
                variant: 'solid',
                size: 'md',
                asLink: true,
                className: 'w-full',
              })}
            >
              Request new link
              <ArrowRightTailIcon aria-hidden style={{ fontSize: 20 }} />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ConfigProvider theme={siteFormTheme}>
      <div className="w-full rounded-3xl border border-[#E6EDFB] bg-white p-6 sm:p-8">
        <AuthCardHeader />

        <h2 className="mt-6 text-2xl font-semibold tracking-[-1px] text-[#0E203E]">
          Reset your password
        </h2>
        <p className="mt-2 text-sm text-[#5C6370]">
          Re-enter your password to gain access back to your account.
        </p>

        <Form
          className="site-form mt-6"
          disabled={resetting}
          form={form}
          layout="vertical"
          onFinish={submit}
          onValuesChange={() => setFailed(false)}
          requiredMark={false}
          validateTrigger="onSubmit"
        >
          <Form.Item
            label="New password"
            name="password"
            rules={[
              { required: true, message: 'Password is required' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              placeholder="***********"
              prefix={<LockIcon aria-hidden className="!text-[#0E203E]" />}
            />
          </Form.Item>

          <Form.Item
            dependencies={['password']}
            label="Re-enter password"
            name="confirm"
            rules={[
              { required: true, message: 'Please re-enter your password' },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  !value || value === getFieldValue('password')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Passwords do not match')),
              }),
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              placeholder="***********"
              prefix={<LockIcon aria-hidden className="!text-[#0E203E]" />}
            />
          </Form.Item>

          {failed && (
            <FormError className="mb-4">Password reset failed. Please try again!</FormError>
          )}

          <SiteButton
            type="submit"
            size="md"
            variant="solid"
            className="!mt-6 w-full"
            loading={resetting}
            icon={<ArrowRightTailIcon aria-hidden style={{ fontSize: 20 }} />}
            iconPlacement="end"
          >
            Reset password
          </SiteButton>

          <div className="mt-4 text-center">
            <Link href="/admin/login" className="text-sm font-semibold text-[#2F7AD2]">
              Back to Sign In
            </Link>
          </div>
        </Form>
      </div>
    </ConfigProvider>
  )
}
