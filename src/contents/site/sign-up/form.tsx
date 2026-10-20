'use client'

import SiteButton from '@/components/common/button'
import { CardIdentityIcon } from '@/components/icon/card-identity'
import { ChurchIcon } from '@/components/icon/church'
import { LockIcon } from '@/components/icon/lock'
import { MailIcon } from '@/components/icon/mail'
import { AuthCardSection } from '@/components/site/auth/auth-card'
import OAuthButtons from '@/components/site/auth/oauth-buttons'
import PasswordStrength from '@/components/site/auth/password-strength'
import StepHeader from '@/components/site/auth/step-header'
import FormError from '@/components/site/form-error'
import { signupErrorOf, SignupPayload, useSignup } from '@/hooks/data/site/auth'
import { useSiteI18n } from '@/i18n/site-i18n'
import { Form, Input } from 'antd'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const help = (text: string) => <span className="text-xs text-neutral-500">{text}</span>
const iconClass = '!text-primary-900'

/*
 * Sign-up (W02 / WB-12), design: docs/website/design/wb1/page-sign-up-step-1.png.
 * Name, email and password only. Language and main church are onboarding
 * steps after the first sign-in (/customer/setup, decision R-06).
 */
export default function SignUpForm() {
  const { t } = useSiteI18n()
  const router = useRouter()
  const [form] = Form.useForm<SignupPayload>()
  const [generalError, setGeneralError] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const password = Form.useWatch('password', form) ?? ''
  const { onSignup, loading } = useSignup()

  const createAccount = async (values: SignupPayload) => {
    setGeneralError(false)
    try {
      const result = await onSignup({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
      })
      setSentTo(result.email)
    } catch (e) {
      const fieldError = signupErrorOf(e)
      if (!fieldError) return setGeneralError(true)
      form.setFields([{ name: fieldError.field, errors: [t(fieldError.message)] }])
    }
  }

  if (sentTo) {
    return (
      <AuthCardSection>
        <h1 className="font-font_heading text-2xl font-bold tracking-tight text-primary-900 md:text-[32px]">
          {t('signUpSuccessTitle')}
        </h1>
        <p className="mt-2 text-neutral-600">{t('signUpSuccessBody', { email: sentTo })}</p>
        <SiteButton className="mt-6" onClick={() => router.push('/login')} size="lg">
          {t('signUpSuccessAction')}
        </SiteButton>
      </AuthCardSection>
    )
  }

  return (
    <>
      <AuthCardSection>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-500">
          {t('signUpEyebrow')}
        </span>
        <h1 className="mt-2 font-font_heading text-2xl font-bold tracking-tight text-primary-900 md:text-[32px]">
          {t('signUpTitle')}
        </h1>
        <p className="mt-2 text-neutral-600">{t('signUpSubtitle')}</p>
      </AuthCardSection>

      <AuthCardSection className="border-t border-neutral-200">
        <Form
          className="site-form"
          // Lock every field while the account is being created.
          disabled={loading}
          form={form}
          layout="vertical"
          onFinish={createAccount}
          requiredMark={false}
          validateTrigger="onSubmit"
        >
          <StepHeader step={1} title={t('signUpStep1Title')} />
          <div className="mt-4">
            <Form.Item
              extra={help(t('signUpNameHelp'))}
              label={t('signUpNameLabel')}
              name="full_name"
              rules={[{ required: true, whitespace: true, message: t('signUpErrorName') }]}
            >
              <Input
                autoComplete="name"
                placeholder={t('signUpNamePlaceholder')}
                prefix={
                  <CardIdentityIcon aria-hidden className={iconClass} style={{ fontSize: 24 }} />
                }
              />
            </Form.Item>
            <Form.Item
              extra={help(t('signUpEmailHelp'))}
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
                prefix={<MailIcon aria-hidden className={iconClass} />}
              />
            </Form.Item>
            <Form.Item
              className="!mb-2"
              label={t('signUpPasswordLabel')}
              name="password"
              rules={[
                { required: true, message: t('signUpErrorPassword') },
                { min: 8, message: t('signUpErrorPassword') },
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                placeholder="••••••••••••"
                prefix={<LockIcon aria-hidden className={iconClass} />}
              />
            </Form.Item>
            <PasswordStrength password={password} />
          </div>

          {generalError && <FormError className="mt-6">{t('error')}</FormError>}

          <div className="mt-8 flex md:justify-end">
            <SiteButton
              className="w-full md:w-auto"
              desktopSize="lg"
              icon={<ChurchIcon aria-hidden style={{ fontSize: 20 }} />}
              loading={loading}
              size="md"
              type="submit"
            >
              {t('signUpSubmit')}
            </SiteButton>
          </div>
        </Form>
      </AuthCardSection>

      <div className="flex items-center gap-4 py-1">
        <span aria-hidden className="h-px flex-1 bg-neutral-200" />
        <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          {t('signUpAltDivider')}
        </span>
        <span aria-hidden className="h-px flex-1 bg-neutral-200" />
      </div>

      <AuthCardSection className="grid gap-4 pt-4 sm:grid-cols-2 md:pt-4">
        <OAuthButtons appleLabel={t('signUpApple')} googleLabel={t('signUpGoogle')} />
      </AuthCardSection>
    </>
  )
}
