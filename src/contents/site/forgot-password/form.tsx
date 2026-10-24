'use client'

import SiteButton from '@/components/common/button'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { MailIcon } from '@/components/icon/mail'
import {
  RecoveryBackLink,
  RecoveryCard,
  RecoveryHeading,
  RecoveryLockMark,
  RecoveryQuote,
  RecoveryResult,
} from '@/components/site/auth/recovery-layout'
import FormError from '@/components/site/form-error'
import { useForgotPassword } from '@/hooks/data/site/password'
import { errorCodeOf, remainingSecondsOf } from '@/hooks/data/site/verify'
import { useSiteI18n } from '@/i18n/site-i18n'
import { Form, Input } from 'antd'
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
      <RecoveryResult
        actionHref="/login"
        actionLabel={t('signUpSuccessAction')}
        body={t('forgotSentBody')}
        eyebrow={t('recoveryEmailSentEyebrow')}
        title={t('forgotSentTitle')}
      />
    )
  }

  return (
    <RecoveryCard>
      <RecoveryLockMark />
      <RecoveryHeading body={t('forgotSubtitle')} title={t('forgotTitle')} />
      <RecoveryQuote />

      <Form
        className="site-form mt-8"
        disabled={sending}
        form={form}
        layout="vertical"
        onFinish={submit}
        requiredMark={false}
        validateTrigger="onSubmit"
      >
        <Form.Item
          className="!mb-2"
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
        <p className="mb-4 px-2 text-xs leading-5 text-neutral-500">{t('forgotEmailHelp')}</p>

        {failed && <FormError className="mb-4">{t('error')}</FormError>}

        <SiteButton
          className="w-full"
          disabled={cooldown > 0}
          icon={<ArrowRightIcon aria-hidden style={{ fontSize: 18 }} />}
          iconPlacement="end"
          loading={sending}
          size="lg"
          type="submit"
        >
          {cooldown > 0 ? t('resendCooldown', { seconds: cooldown }) : t('forgotSubmit')}
        </SiteButton>

        <div className="mt-8">
          <RecoveryBackLink />
        </div>
      </Form>
    </RecoveryCard>
  )
}
