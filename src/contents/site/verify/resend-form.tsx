'use client'

import SiteButton from '@/components/common/button'
import { MailIcon } from '@/components/icon/mail'
import FormError from '@/components/site/form-error'
import { errorCodeOf, remainingSecondsOf, useResendVerification } from '@/hooks/data/site/verify'
import { useSiteI18n } from '@/i18n/site-i18n'
import { Form, Input } from 'antd'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Notice = 'sent' | 'alreadyVerified' | null

/*
 * Resend the verification link (W03). Prefilled when the email is known.
 * After a send (or a "too early" answer) the button counts down the
 * server cooldown. The success text is soft on purpose: the backend answers
 * the same for unknown emails (no account enumeration).
 */
export default function ResendForm({
  centered = false,
  initialEmail = '',
}: {
  centered?: boolean
  initialEmail?: string
}) {
  const { t } = useSiteI18n()
  const [form] = Form.useForm<{ email: string }>()
  const { onResend, sending } = useResendVerification()
  const [cooldown, setCooldown] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const resend = async ({ email }: { email: string }) => {
    setNotice(null)
    setFailed(false)
    try {
      const result = await onResend(email.trim())
      setNotice('sent')
      setCooldown(result.cooldown_seconds)
    } catch (e) {
      const code = errorCodeOf(e)
      if (code === 'RESEND_TOO_EARLY') return setCooldown(remainingSecondsOf(e) ?? 60)
      if (code === 'ALREADY_VERIFIED') return setNotice('alreadyVerified')
      if (code === 'INVALID_EMAIL') {
        return form.setFields([{ name: 'email', errors: [t('signUpErrorEmail')] }])
      }
      setFailed(true)
    }
  }

  return (
    <Form
      className={`site-form ${
        centered
          ? '[&_.ant-form-item-explain]:text-center [&_.ant-form-item-label]:text-center'
          : ''
      }`}
      disabled={sending}
      form={form}
      initialValues={{ email: initialEmail }}
      layout="vertical"
      onFinish={resend}
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

      {notice === 'sent' && (
        <p
          className="mb-4 rounded-lg bg-primary-100 px-4 py-3 text-xs text-primary-950 md:text-sm"
          role="status"
        >
          {t('resendSent')}
        </p>
      )}
      {notice === 'alreadyVerified' && (
        <p
          className="mb-4 rounded-lg bg-primary-100 px-4 py-3 text-xs text-primary-950 md:text-sm"
          role="status"
        >
          {t('resendAlreadyVerified')}{' '}
          <Link className="font-semibold text-primary-500" href="/login">
            {t('signUpSignIn')}
          </Link>
        </p>
      )}
      {failed && <FormError className="mb-4">{t('error')}</FormError>}

      <SiteButton
        className="w-full md:w-auto"
        desktopSize="lg"
        disabled={cooldown > 0}
        loading={sending}
        size="md"
        type="submit"
      >
        {cooldown > 0 ? t('resendCooldown', { seconds: cooldown }) : t('resendSubmit')}
      </SiteButton>
    </Form>
  )
}
