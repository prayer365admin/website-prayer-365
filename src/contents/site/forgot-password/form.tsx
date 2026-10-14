'use client'

import SiteButton from '@/components/common/button'
import { MailIcon } from '@/components/icon/mail'
import Confirmation from '@/components/site/auth/confirmation'
import FormError from '@/components/site/form-error'
import { useForgotPassword } from '@/hooks/data/site/password'
import { errorCodeOf, remainingSecondsOf } from '@/hooks/data/site/verify'
import { useSiteI18n } from '@/i18n/site-i18n'
import { Form, Input } from 'antd'
import Link from 'next/link'
import { useEffect, useState } from 'react'

/*
 * Forgot password form (W04). The backend answers the same for unknown emails
 * (no account enumeration), so the confirmation is always "check your email".
 * A repeat request inside the cooldown counts down instead of failing.
 */
export default function ForgotPasswordForm() {
  const { t } = useSiteI18n()
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
        return form.setFields([{ name: 'email', errors: [t('signUpErrorEmail')] }])
      }
      setFailed(true)
    }
  }

  if (sent) {
    return (
      <Confirmation
        linkHref="/login"
        linkLabel={t('signUpSuccessAction')}
        title={t('forgotSentTitle')}
      >
        {t('forgotSentBody')}
      </Confirmation>
    )
  }

  return (
    <Form
      className="site-form"
      disabled={sending}
      form={form}
      layout="vertical"
      onFinish={submit}
      requiredMark={false}
      validateTrigger="onSubmit"
    >
      <Form.Item
        label={t('signUpEmailLabel')}
        name="email"
        rules={[
          { required: true, message: t('signUpErrorEmail') },
          { type: 'email', message: t('signUpErrorEmail') },
        ]}
      >
        <Input
          autoComplete="email"
          placeholder={t('signUpEmailPlaceholder')}
          prefix={<MailIcon aria-hidden className="!text-primary-900" />}
        />
      </Form.Item>

      {failed && <FormError className="mb-4">{t('error')}</FormError>}

      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <SiteButton
          className="w-full md:w-auto"
          desktopSize="lg"
          disabled={cooldown > 0}
          loading={sending}
          size="md"
          type="submit"
        >
          {cooldown > 0 ? t('resendCooldown', { seconds: cooldown }) : t('forgotSubmit')}
        </SiteButton>
        <Link className="self-center text-sm font-semibold text-primary-500" href="/login">
          {t('signUpSuccessAction')}
        </Link>
      </div>
    </Form>
  )
}
