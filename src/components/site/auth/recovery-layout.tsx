'use client'

import { ArrowLeftOutlined, CloseOutlined } from '@ant-design/icons'
import { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { LockIcon } from '@/components/icon/lock'
import { QuoteIcon } from '@/components/icon/quote'
import { ShieldCheckIcon } from '@/components/icon/shield-check'
import { SuccessIcon } from '@/components/icon/success'
import { siteFormTheme } from '@/config/antdTheme'
import { useSiteI18n } from '@/i18n/site-i18n'
import ConfigProvider from 'antd/es/config-provider'

export function RecoveryLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[calc(100vh-66px)] items-start bg-[radial-gradient(circle_at_50%_0%,rgba(194,217,255,0.38),transparent_44%),#f7f9fb] px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
      <ConfigProvider theme={siteFormTheme}>
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
          {children}
          <RecoverySafeguards />
        </div>
      </ConfigProvider>
    </main>
  )
}

export function RecoveryCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl bg-white px-5 py-8 shadow-[0_1px_2px_rgba(14,32,62,0.08)] sm:px-8 sm:py-9 ${className}`}
    >
      {children}
    </section>
  )
}

export function RecoveryLockMark() {
  return (
    <span
      className="mx-auto flex size-[72px] items-center justify-center rounded-full p-[7px]"
      style={{
        background: 'linear-gradient(139.79deg, #B9D8F8 15.71%, #FFFFFF 51.2%, #77B4F2 79.59%)',
        boxShadow: '0 12px 24px -12px #2F7AD2, -12px -12px 24px -12px #FFFFFF',
      }}
    >
      <span className="flex size-full items-center justify-center rounded-full bg-white text-primary-500">
        <LockIcon aria-hidden className="text-2xl" />
      </span>
    </span>
  )
}

export function RecoveryHeading({ title, body }: { title: string; body?: string }) {
  return (
    <header className="mt-8 text-center">
      <h1 className="font-font_heading text-2xl font-bold tracking-[-0.03em] text-primary-900 sm:text-[32px]">
        {title}
      </h1>
      {body && (
        <p className="mx-auto mt-2 max-w-[500px] text-sm leading-6 text-neutral-600 sm:text-base">
          {body}
        </p>
      )}
    </header>
  )
}

export function RecoveryQuote() {
  const { t } = useSiteI18n()

  return (
    <figure className="mt-8 rounded-xl bg-neutral-50 p-5 sm:px-6">
      <div className="flex items-start gap-3">
        <QuoteIcon aria-hidden className="mt-1 shrink-0 text-primary-500" />
        <div>
          <blockquote className="font-font_quote text-[32px] italic leading-[1.28] text-blue-800">
            “{t('recoveryQuote')}”
          </blockquote>
          <figcaption className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-600">
            {t('recoveryQuoteRef')}
          </figcaption>
        </div>
      </div>
    </figure>
  )
}

export function RecoveryBackLink() {
  const { t } = useSiteI18n()
  return (
    <Link
      className="inline-flex items-center gap-2 text-sm font-medium text-primary-500"
      href="/login"
    >
      <ArrowLeftOutlined aria-hidden />
      {t('signUpSuccessAction')}
    </Link>
  )
}

export function RecoveryResult({
  title,
  body,
  eyebrow,
  status = 'success',
  actionHref,
  actionLabel,
}: {
  title: string
  body: string
  eyebrow?: string
  status?: 'success' | 'error'
  actionHref: string
  actionLabel: string
}) {
  return (
    <RecoveryCard className="text-center">
      {status === 'success' ? (
        <SuccessIcon aria-hidden className="mx-auto block" style={{ fontSize: 120 }} />
      ) : (
        <span className="mx-auto flex size-24 items-center justify-center rounded-full border-2 border-danger-500 text-4xl text-danger-500">
          <CloseOutlined aria-hidden />
        </span>
      )}
      {eyebrow && (
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary-500">
          {eyebrow}
        </p>
      )}
      <h1
        className={`${eyebrow ? 'mt-2' : 'mt-8'} font-font_heading text-2xl font-bold tracking-[-0.03em] text-primary-900 sm:text-[32px]`}
      >
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
      <Link
        className="mt-10 flex h-14 w-full items-center justify-center rounded-xl border border-primary-600 bg-primary-500 px-6 text-base font-semibold text-white transition hover:border-primary-700 hover:bg-primary-700 hover:text-white"
        href={actionHref}
      >
        {actionLabel}
        <ArrowRightIcon aria-hidden className="ml-3 text-xl" />
      </Link>
    </RecoveryCard>
  )
}

function RecoverySafeguards() {
  const { t } = useSiteI18n()

  return (
    <aside
      className="flex items-start gap-4 rounded-2xl p-4 shadow-[0_1px_2px_rgba(14,32,62,0.06)] sm:px-5"
      style={{
        background:
          'linear-gradient(135deg, rgba(194, 217, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(0deg, #FFFFFF, #FFFFFF)',
      }}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-150 text-primary-500">
        <ShieldCheckIcon aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="font-font_heading text-base font-semibold text-primary-900">
          {t('recoverySafeguardsTitle')}
        </h2>
        <p className="mt-1 text-sm leading-5 text-neutral-600">{t('recoverySafeguardsBody')}</p>
      </div>
    </aside>
  )
}
