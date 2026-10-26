'use client'

import SiteButton, { siteButtonClassName } from '@/components/common/button'
import { ArrowRightTailIcon } from '@/components/icon/arrow-right-tail'
import { MailIcon } from '@/components/icon/mail'
import { SuccessIcon } from '@/components/icon/success'
import FormError from '@/components/site/form-error'
import { siteFormTheme } from '@/config/antdTheme'
import AuditNotice from '@/contents/admin/sign-in/audit-notice'
import AuthCardHeader from '@/contents/admin/sign-in/auth-card-header'
import { useForgotPassword } from '@/hooks/data/site/password'
import { errorCodeOf, remainingSecondsOf } from '@/hooks/data/site/verify'
import ConfigProvider from 'antd/es/config-provider'
import { Form, Input } from 'antd'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function ForgotPasswordForm() {
  const [form] = Form.useForm<{ email: string }>()
  const { onForgot, sending } = useForgotPassword()
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const submit = async ({ email }: { email: string }) => {
    setFailed(false)
    try {
      await onForgot(email.trim())
      setSent(true)
    } catch (e) {
      const code = errorCodeOf(e)
      if (code === 'RESET_TOO_EARLY') return setCooldown(remainingSecondsOf(e) ?? 60)
      if (code === 'INVALID_EMAIL') {
        return form.setFields([{ name: 'email', errors: ['Please enter a valid email address'] }])
      }
      setFailed(true)
    }
  }

  if (sent) {
    return (
      <div className="w-full rounded-3xl border border-[#E6EDFB] bg-white p-6 sm:p-8">
        <AuthCardHeader showEncrypted={false} />
        <div className="mt-8 flex flex-col items-center text-center">
          <SuccessIcon aria-hidden className="text-[#09A97C]" style={{ fontSize: 96 }} />
          <h2 className="mt-6 text-2xl font-semibold tracking-[-1px] text-[#0E203E]">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-[#5C6370]">
            If your email is registered, a password reset link has been sent to your email address.
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
              Back to Sign In
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
        <AuthCardHeader showEncrypted={false} />

        <h2 className="mt-6 text-2xl font-semibold tracking-[-1px] text-[#0E203E]">
          Get back to your account
        </h2>
        <p className="mt-2 text-sm text-[#5C6370]">
          Enter your email address connected to your account. We&apos;ll send a link to reset your
          password.
        </p>

        <Form
          className="site-form mt-6"
          disabled={sending}
          form={form}
          layout="vertical"
          onFinish={submit}
          onValuesChange={() => setFailed(false)}
          requiredMark={false}
          validateTrigger="onSubmit"
        >
          <Form.Item
            label="Official Church / Staff Email"
            name="email"
            rules={[
              { required: true, whitespace: true, message: 'Email is required' },
              {
                type: 'email',
                transform: (value: string) => value?.trim(),
                message: 'Please enter a valid email address',
              },
            ]}
          >
            <Input
              autoComplete="email"
              placeholder="pastor.carter@gracechurchwestminster.org"
              prefix={<MailIcon aria-hidden className="!text-[#0E203E]" />}
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
            disabled={cooldown > 0}
            loading={sending}
            icon={<ArrowRightTailIcon aria-hidden style={{ fontSize: 20 }} />}
            iconPlacement="end"
          >
            {cooldown > 0 ? `Send again in ${cooldown}s` : 'Submit'}
          </SiteButton>

          <div className="mt-4">
            <AuditNotice>
              Your prayer petitions, confessions, and church tithing remain private, encrypted, and
              pastorally guarded.
            </AuditNotice>
          </div>
        </Form>
      </div>
    </ConfigProvider>
  )
}
