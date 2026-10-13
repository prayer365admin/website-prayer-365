'use client'

import SiteButton from '@/components/common/button'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { CardIdentityIcon } from '@/components/icon/card-identity'
import { ChurchIcon } from '@/components/icon/church'
import { LanguageIcon } from '@/components/icon/language'
import { LockIcon } from '@/components/icon/lock'
import { MailIcon } from '@/components/icon/mail'
import { PilgrimIcon } from '@/components/icon/pilgrim'
import { AuthCardSection } from '@/components/site/auth/auth-card'
import PasswordStrength from '@/components/site/auth/password-strength'
import Pill from '@/components/site/auth/pill'
import StepHeader from '@/components/site/auth/step-header'
import FormError from '@/components/site/form-error'
import { SITE_LOCALE_NAMES, SITE_LOCALES, SiteLocale } from '@/config/site-locale'
import { signupErrorOf, SignupPayload, useSignup } from '@/hooks/data/site/auth'
import { useChurchOptions, useFrequentChurches } from '@/hooks/data/site/church-option'
import { SiteMessageKey } from '@/i18n/messages'
import { useSiteI18n } from '@/i18n/site-i18n'
import { ChurchOption } from '@/models/church-option'
import { Checkbox, Form, Input, Select } from 'antd'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const TOTAL_STEPS = 3

// Which step shows each field, so a backend error can jump back to it.
const FIELD_STEP: Record<keyof SignupPayload, number> = {
  full_name: 1,
  email: 1,
  password: 1,
  main_church_id: 2,
  locale: 3,
}

type FieldError = { field: keyof SignupPayload; message: SiteMessageKey }

const help = (text: string) => <span className="text-xs text-neutral-500">{text}</span>
const iconClass = '!text-primary-900'

/*
 * Sign-up wizard (W02 / WB-12), designs: docs/website/design/wb1/page-sign-up-step-{1,2,3}.png.
 * One antd Form across the 3 steps: only the current step is mounted, values
 * persist (Form preserve), Next validates the mounted step, one signup call at
 * the end. Language is required; the main church is optional. The two
 * step-3 checkboxes are UI only (decision B3/F3, REPORT R-03).
 */
export default function SignUpForm() {
  const { t, locale, setLocale } = useSiteI18n()
  const router = useRouter()
  const [form] = Form.useForm<SignupPayload>()
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<ChurchOption | null>(null)
  const pendingError = useRef<FieldError | null>(null)
  const [generalError, setGeneralError] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const password = Form.useWatch('password', form) ?? ''
  const churchId = Form.useWatch('main_church_id', form)
  const { data: options, loading: searching } = useChurchOptions(search)
  const { data: frequent } = useFrequentChurches()
  const { onSignup, loading } = useSignup()

  // A backend error targets a field on another step: show it once that step is mounted.
  useEffect(() => {
    const error = pendingError.current
    if (!error || FIELD_STEP[error.field] !== step) return
    form.setFields([{ name: error.field, errors: [t(error.message)] }])
    pendingError.current = null
  }, [form, step, t])

  const known = [...(picked ? [picked] : []), ...frequent, ...options]
  // While searching, list only the results (+ the picked parish so its label stays).
  const listed = search.trim() ? [...(picked ? [picked] : []), ...options] : known
  const pick = (church: ChurchOption) => {
    setPicked(church)
    form.setFields([{ name: 'main_church_id', value: church.id, errors: [] }])
  }

  const createAccount = async () => {
    const values = form.getFieldsValue(true) as SignupPayload
    setGeneralError(false)
    try {
      const result = await onSignup({
        ...values,
        full_name: values.full_name.trim(),
        email: values.email.trim(),
      })
      // Remember the chosen language for the site, then show "check your email".
      setLocale(values.locale as SiteLocale)
      setSentTo(result.email)
    } catch (e) {
      const fieldError = signupErrorOf(e)
      if (!fieldError) return setGeneralError(true)
      // Field on this step: show it now. Otherwise jump there; the effect shows it.
      if (FIELD_STEP[fieldError.field] === step) {
        return form.setFields([{ name: fieldError.field, errors: [t(fieldError.message)] }])
      }
      pendingError.current = fieldError
      setStep(FIELD_STEP[fieldError.field])
    }
  }

  // Enter or Next submits: antd validates only the mounted (current) step.
  const onFinish = () => (step < TOTAL_STEPS ? setStep(step + 1) : createAccount())

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

  const back = (
    <button
      className="inline-flex h-12 items-center gap-2 self-center text-base font-semibold text-primary-500 disabled:cursor-not-allowed disabled:text-neutral-200 md:h-auto md:self-auto"
      disabled={loading}
      onClick={() => setStep(step - 1)}
      type="button"
    >
      <ArrowRightIcon aria-hidden className="rotate-180" style={{ fontSize: 24 }} />
      {t('signUpBack')}
    </button>
  )
  // Phones: Back centered on top, md-size primary button full width below.
  // Desktop: one row, lg button.
  const actionsClass =
    'mt-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between'
  const next = (
    <SiteButton
      className="w-full md:w-auto"
      desktopSize="lg"
      icon={<ArrowRightIcon aria-hidden style={{ fontSize: 24 }} />}
      iconPlacement="end"
      size="md"
      type="submit"
    >
      {t('signUpNext')}
    </SiteButton>
  )

  return (
    <>
      <AuthCardSection>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-500">
            {t('signUpEyebrow')}
          </span>
          <span className="text-xs text-neutral-400">
            {t('formProgress', { n: step, total: TOTAL_STEPS })}
          </span>
        </div>
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
          initialValues={{ locale }}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          validateTrigger="onSubmit"
        >
          {step === 1 && (
            <>
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
                      <CardIdentityIcon
                        aria-hidden
                        className={iconClass}
                        style={{ fontSize: 24 }}
                      />
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
              <div className="mt-8 flex md:justify-end">{next}</div>
            </>
          )}

          {step === 2 && (
            <>
              <StepHeader
                badge={<Pill>{t('signUpOptional')}</Pill>}
                step={2}
                title={t('signUpStep2Title')}
              />
              <p className="mt-3 text-sm text-neutral-600">{t('signUpStep2Body')}</p>
              <Form.Item className="!mt-4" label={t('signUpChurchLabel')} name="main_church_id">
                <Select
                  allowClear
                  loading={searching}
                  notFoundContent={t('signUpChurchEmpty')}
                  onChange={(id: string) => {
                    const church = known.find((c) => c.id === id)
                    if (church) setPicked(church)
                  }}
                  options={Array.from(new Map(listed.map((c) => [c.id, c])).values()).map((c) => ({
                    value: c.id,
                    label: c.city ? `${c.name}, ${c.city}` : c.name,
                  }))}
                  placeholder={t('signUpChurchPlaceholder')}
                  prefix={<PilgrimIcon aria-hidden className={`${iconClass} !me-3`} />}
                  // antd v6 search API: search the server, don't filter the loaded options.
                  showSearch={{ filterOption: false, onSearch: setSearch }}
                />
              </Form.Item>
              {frequent.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>{t('signUpFrequent')}</span>
                  {frequent.map((church) => (
                    <button
                      aria-pressed={churchId === church.id}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-300 ${
                        churchId === church.id
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-neutral-100 text-primary-900 hover:bg-neutral-200'
                      }`}
                      key={church.id}
                      onClick={() => pick(church)}
                      type="button"
                    >
                      {church.name}
                    </button>
                  ))}
                </div>
              )}
              <div className={actionsClass}>
                {back}
                {next}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="mb-8">
                <StepHeader step={3} title={t('signUpStep3Title')} />
                <Form.Item
                  className="!mt-4"
                  label={t('signUpLanguageLabel')}
                  name="locale"
                  rules={[{ required: true, message: t('signUpErrorLocale') }]}
                >
                  <Select
                    options={SITE_LOCALES.map((code) => ({
                      value: code,
                      label: SITE_LOCALE_NAMES[code],
                    }))}
                    prefix={<LanguageIcon aria-hidden className={`${iconClass} !me-3`} />}
                  />
                </Form.Item>
              </div>

              {/* UI only until notification preferences exist (REPORT R-03). */}
              <div className="-mx-6 flex flex-col gap-4 border-t border-neutral-200 px-6 pt-6 md:-mx-8 md:px-8">
                {(
                  [
                    ['signUpDevotionalTitle', 'signUpDevotionalBody'],
                    ['signUpAlertsTitle', 'signUpAlertsBody'],
                  ] as const
                ).map(([title, body]) => (
                  <Checkbox
                    // antd centers the box itself (align-self); pin it to the title's first line.
                    className="flex !items-start [&_.ant-checkbox]:!mt-0.5 [&_.ant-checkbox]:!self-start"
                    key={title}
                  >
                    <span className="block text-sm font-semibold text-primary-900">{t(title)}</span>
                    <span className="block text-sm text-neutral-600">{t(body)}</span>
                  </Checkbox>
                ))}
              </div>

              {generalError && <FormError className="mt-6">{t('error')}</FormError>}

              <div className={actionsClass}>
                {back}
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
            </>
          )}
        </Form>
      </AuthCardSection>
    </>
  )
}
