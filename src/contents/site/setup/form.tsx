'use client'

import SiteButton from '@/components/common/button'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { ChurchIcon } from '@/components/icon/church'
import { LanguageIcon } from '@/components/icon/language'
import { PilgrimIcon } from '@/components/icon/pilgrim'
import { AuthCardSection } from '@/components/site/auth/auth-card'
import Pill from '@/components/site/auth/pill'
import StepHeader from '@/components/site/auth/step-header'
import FormError from '@/components/site/form-error'
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_NAMES,
  SITE_LOCALES,
  SiteLocale,
} from '@/config/site-locale'
import { useChurchOptions, useFrequentChurches } from '@/hooks/data/site/church-option'
import { useMe } from '@/hooks/data/site/me'
import { useSiteI18n } from '@/i18n/site-i18n'
import { ChurchOption } from '@/models/church-option'
import { MobileMe } from '@/models/mobile'
import { CUSTOMER_HOME, SetupProgress, writeSetupProgress } from '@/utils/setup-progress-storage'
import { Checkbox, Form, Select } from 'antd'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const TOTAL_STEPS = 2

type SetupValues = { main_church_id?: string; locale: SiteLocale }

const iconClass = '!text-primary-900'

/*
 * First-login onboarding (W05 / WB-15), designs: docs/website/design/wb1/page-sign-up-step-{2,3}.png.
 * Locale and main church are chosen after signup (R-06). Each step persists
 * independently through PATCH /api/v1/site/me. The parish is optional, so
 * "Skip for now" saves no main church and advances to language. The two
 * step-2 checkboxes are UI only (REPORT R-03).
 */
export default function SetupForm({
  initialMe,
  initialStep = 1,
}: {
  initialMe?: MobileMe
  initialStep?: 1 | 2
}) {
  const { t, locale, setLocale } = useSiteI18n()
  const router = useRouter()
  const [form] = Form.useForm<SetupValues>()
  const [step, setStep] = useState(initialStep)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<ChurchOption | null>(null)
  const [failed, setFailed] = useState(false)
  const churchId = Form.useWatch('main_church_id', form)
  const { data: options, loading: searching } = useChurchOptions(search)
  const { data: frequent } = useFrequentChurches()
  const { onPatch, patching } = useMe({ userId: initialMe?.id, initialData: initialMe })

  const known = [...(picked ? [picked] : []), ...frequent, ...options]
  // While searching, list only the results (+ the picked parish so its label stays).
  const listed = search.trim() ? [...(picked ? [picked] : []), ...options] : known
  const pick = (church: ChurchOption) => {
    setPicked(church)
    form.setFields([{ name: 'main_church_id', value: church.id, errors: [] }])
  }

  // Record this browser's view of the progress (WB-15), so the setup guard
  // knows it already asked; a clean browser checks the account again.
  const record = (progress: Omit<SetupProgress, 'completed'>) => {
    if (initialMe?.id) {
      writeSetupProgress(initialMe.id, {
        ...progress,
        completed: progress.churchStepDone && progress.localeStepDone,
      })
    }
  }
  useEffect(() => {
    record({ churchStepDone: initialStep === 2, localeStepDone: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveChurch = async (mainChurchId: string | null) => {
    setFailed(false)
    try {
      // A chosen church records church_setup_completed_at; null (skip) does not.
      await onPatch({ mainChurchId })
      record({ churchStepDone: !!mainChurchId, localeStepDone: false })
      setStep(2)
    } catch {
      setFailed(true)
    }
  }

  const finish = async (localeOverride?: SiteLocale) => {
    const values = form.getFieldsValue(true) as SetupValues
    const selectedLocale = localeOverride ?? values.locale
    setFailed(false)
    try {
      // Skip saves the default locale but leaves the language step unfilled.
      await onPatch(
        localeOverride
          ? { locale: selectedLocale, localeSkipped: true }
          : { locale: selectedLocale },
      )
      setLocale(selectedLocale)
      record({ churchStepDone: !!picked || initialStep === 2, localeStepDone: !localeOverride })
      router.push(CUSTOMER_HOME)
    } catch {
      setFailed(true)
    }
  }

  // Enter or Next submits: antd validates only the mounted (current) step.
  const onFinish = () =>
    step < TOTAL_STEPS ? saveChurch(form.getFieldValue('main_church_id') ?? null) : finish()

  // Phones: secondary action centered on top, md-size primary button full width below.
  // Desktop: one row, lg button.
  const actionsClass =
    'mt-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between'
  const textButton =
    'inline-flex h-12 items-center gap-2 self-center text-base font-semibold text-primary-500 disabled:cursor-not-allowed disabled:text-neutral-200 md:h-auto md:self-auto'

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
          {t('setupTitle')}
        </h1>
        <p className="mt-2 text-neutral-600">{t('setupSubtitle')}</p>
      </AuthCardSection>

      <AuthCardSection className="border-t border-neutral-200">
        <Form
          className="site-form"
          // Lock every field while saving.
          disabled={patching}
          form={form}
          initialValues={{ locale }}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          validateTrigger="onSubmit"
        >
          {step === 1 && (
            <>
              <StepHeader
                badge={<Pill>{t('signUpOptional')}</Pill>}
                step={1}
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
              {failed && <FormError className="mt-6">{t('error')}</FormError>}
              <div className={actionsClass}>
                <button
                  className={textButton}
                  disabled={patching}
                  onClick={() => {
                    form.setFieldValue('main_church_id', undefined)
                    void saveChurch(null)
                  }}
                  type="button"
                >
                  {t('setupSkip')}
                </button>
                <SiteButton
                  className="w-full md:w-auto"
                  desktopSize="lg"
                  icon={<ArrowRightIcon aria-hidden style={{ fontSize: 24 }} />}
                  iconPlacement="end"
                  loading={patching}
                  size="md"
                  type="submit"
                >
                  {t('signUpNext')}
                </SiteButton>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-8">
                <StepHeader step={2} title={t('signUpStep3Title')} />
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
                    disabled
                  >
                    <span className="block text-sm font-semibold text-primary-900">{t(title)}</span>
                    <span className="block text-sm text-neutral-600">{t(body)}</span>
                  </Checkbox>
                ))}
              </div>

              {failed && <FormError className="mt-6">{t('error')}</FormError>}

              <div className={actionsClass}>
                <button
                  className={textButton}
                  disabled={patching}
                  onClick={() => void finish(DEFAULT_SITE_LOCALE)}
                  type="button"
                >
                  {t('setupSkip')}
                </button>
                <SiteButton
                  className="w-full md:w-auto"
                  desktopSize="lg"
                  icon={<ChurchIcon aria-hidden style={{ fontSize: 20 }} />}
                  loading={patching}
                  size="md"
                  type="submit"
                >
                  {t('setupFinish')}
                </SiteButton>
              </div>
            </>
          )}
        </Form>
      </AuthCardSection>
    </>
  )
}
