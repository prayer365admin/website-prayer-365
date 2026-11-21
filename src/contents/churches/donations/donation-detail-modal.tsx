'use client'

import { useState } from 'react'
import { Button, Modal } from 'antd'
import { CloseOutlined, CopyOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { GivingIcon } from '@/components/icon/giving'
import type { AdminDonationRow, DonationSubscriptionRow } from '@/models/donation'

import { PaymentStatusPill, ProviderStatusPill, StatusPill } from './status-pill'
import { displayReference, formatMinorToMajor } from './columns'
import { copyToClipboard } from '@/utils/clipboard'

dayjs.extend(utc)

/** Either ledger row the eye can open; the modal renders each variant faithfully. */
export type DonationDetailPayload =
  { kind: 'off'; row: AdminDonationRow } | { kind: 'recurring'; row: DonationSubscriptionRow }

const LABEL = 'text-sm leading-[21px] text-[var(--color-neutral-400)]'
const VALUE = 'text-sm leading-[21px] text-[var(--color-primary-900)]'
const CARD = 'rounded-lg border border-[var(--color-neutral-200)] px-3 py-3'

/** Decorative radial glows behind the masthead icon (Figma "Group 1"). */
const MASTHEAD_GLOWS = [
  {
    width: 287,
    height: 287,
    left: 107,
    top: -20,
    background:
      'radial-gradient(50% 50% at 50% 50%, var(--color-primary-300) 0%, transparent 100%)',
  },
  {
    width: 125,
    height: 125,
    left: 228,
    top: 88,
    opacity: 0.6,
    background: 'radial-gradient(50% 50% at 50% 50%, white 0%, transparent 100%)',
  },
  {
    width: 41,
    height: 41,
    left: 253,
    top: 90,
    opacity: 0.6,
    background:
      'radial-gradient(50% 50% at 50% 50%, var(--color-donation-white-half) 0%, transparent 100%)',
  },
  {
    width: 287,
    height: 287,
    left: -120,
    top: 22,
    background:
      'radial-gradient(50% 50% at 50% 50%, var(--color-donation-glow-deep) 0%, transparent 100%)',
  },
] as const

export const DonationDetailModal = ({
  donation,
  onClose,
}: {
  donation: DonationDetailPayload | null
  onClose: () => void
}) => {
  // Keyed by URL, so a different row's invoice never reuses the last outcome.
  const [copyState, setCopyState] = useState<{ url: string; ok: boolean } | null>(null)

  const isRecurring = donation?.kind === 'recurring'
  const row = donation?.row
  const amount = row
    ? (() => {
        const [code, value = '0.00'] = formatMinorToMajor(row.amountMinor, row.currency).split(' ')
        return `${code === 'EUR' ? '€' : code} ${value}`
      })()
    : ''
  const invoiceUrl = row?.invoiceUrl ?? null
  const date =
    donation?.kind === 'off'
      ? (donation.row.paidAt ?? donation.row.createdAt ?? null)
      : (donation?.row.createdAt ?? null)
  const reference = row ? displayReference(row.id) : ''
  const donor = donation?.kind === 'off' ? donation.row.donor : null

  const copyInvoiceUrl = async () => {
    if (!invoiceUrl) return
    const ok = await copyToClipboard(invoiceUrl)
    setCopyState({ url: invoiceUrl, ok })
  }

  return (
    <Modal
      open={donation !== null}
      onCancel={onClose}
      footer={null}
      centered
      width={400}
      closable={false}
      className="[&_.ant-modal-container]:!overflow-hidden [&_.ant-modal-container]:!rounded-2xl [&_.ant-modal-container]:!p-0 [&_.ant-modal-body]:!p-0"
    >
      {row && (
        <div>
          {/* Masthead: inset blue tile (16px margin, 8px radius) with the spec's radial glows. */}
          <div className="p-4">
            <div className="relative isolate h-[215px] overflow-hidden rounded-lg bg-[var(--color-primary-500)] px-4 pb-4 pt-6 text-center">
              {MASTHEAD_GLOWS.map((glow, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="pointer-events-none absolute z-0 rounded-full"
                  style={glow}
                />
              ))}
              <Button
                aria-label="Close donation details"
                onClick={onClose}
                icon={<CloseOutlined className="!text-[14px] !text-[var(--color-primary-900)]" />}
                className="!absolute right-2 top-2 z-10 !grid !h-8 !w-8 !place-items-center !rounded-lg !border-0 !bg-white !p-0"
              />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div
                  className="grid h-[72px] w-[72px] place-items-center rounded-full"
                  style={{
                    background:
                      'linear-gradient(139.79deg, var(--color-blue-200) 15.71%, white 51.2%, var(--color-primary-300) 79.59%)',
                    boxShadow:
                      '-12px -12px 24px -12px white, 0px 12px 24px -12px var(--color-primary-500)',
                  }}
                >
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-white">
                    <GivingIcon className="!text-[24px] !text-[var(--color-primary-500)]" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="text-sm leading-[21px] text-[var(--color-blue-200)]">
                    {isRecurring ? 'Recurring donation' : 'Donation received'}
                  </div>
                  <div className="text-[32px] font-bold leading-none tracking-[-1px] text-white">
                    {amount}
                  </div>
                  <div className="text-xs leading-[18px] text-white/50">{reference}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-4 pb-4">
            {/* Banner */}
            <div className="flex h-10 items-center gap-1 rounded-lg border border-[var(--color-blue-200)] bg-[var(--color-primary-100)] px-3">
              <GivingIcon className="!text-[14px] !text-[var(--color-primary-650)]" />
              <span className="text-sm font-semibold leading-[21px] text-[var(--color-primary-650)]">
                {isRecurring ? 'Recurring donation.' : '1 off donation'}
              </span>
              {isRecurring && <StatusPill label="Monthly" tone="info" />}
            </div>

            {/* Received from */}
            <div className={`${CARD} flex h-[70px] flex-col gap-1`}>
              <div className={LABEL}>Received from</div>
              {isRecurring ? (
                <div className="flex items-center gap-1.5">
                  <UserOutlined className="!text-[14px] !text-[var(--color-donation-icon)]" />
                  <span className={VALUE}>{row.churchName}</span>
                </div>
              ) : donor ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <UserOutlined className="!text-[14px] !text-[var(--color-donation-icon)]" />
                    <span className={`${VALUE} truncate`}>{donor.name}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MailOutlined className="!text-[14px] !text-[var(--color-donation-icon)]" />
                    <span className="truncate text-sm leading-[21px] text-[var(--color-donation-body)]">
                      {donor.email}
                    </span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <UserOutlined className="!text-[14px] !text-[var(--color-donation-icon)]" />
                  <span className={VALUE}>Guest</span>
                </div>
              )}
            </div>

            {/* Date + status */}
            <div className="flex gap-2">
              <div className={`${CARD} flex h-[88px] w-[180px] flex-col gap-1`}>
                <div className={LABEL}>Payment Date</div>
                <div className={VALUE}>{date ? dayjs(date).format('DD MMMM YYYY') : '—'}</div>
                <div className="text-xs leading-[18px] text-[var(--color-donation-body)]">
                  {date ? `${dayjs(date).utc().format('HH:mm')} UTC` : '—'}
                </div>
              </div>
              <div className={`${CARD} flex h-[88px] w-[180px] flex-col gap-1`}>
                <div className={LABEL}>{isRecurring ? 'Donation Status' : 'Payment Status'}</div>
                <div className="pt-1">
                  {isRecurring ? (
                    <ProviderStatusPill status={donation.row.providerStatus} />
                  ) : (
                    <PaymentStatusPill status={donation.row.status} />
                  )}
                </div>
              </div>
            </div>

            {/* Invoice */}
            <div className="flex h-16 items-center justify-between gap-2 rounded-lg border border-[var(--color-neutral-200)] px-3">
              <div className="min-w-0">
                <div className={LABEL}>Invoice URL</div>
                {invoiceUrl && (
                  <div className="max-w-[160px] truncate text-xs leading-[18px] text-[var(--color-donation-body)]">
                    {invoiceUrl}
                  </div>
                )}
              </div>
              <Button
                onClick={copyInvoiceUrl}
                disabled={!invoiceUrl}
                className="!flex !h-10 !items-center !gap-2 !rounded-lg !border !border-[var(--color-primary-500)] !bg-white !px-2 !pl-3 !text-sm !font-semibold !text-[var(--color-primary-500)] disabled:!border-[var(--color-neutral-200)] disabled:!text-[var(--color-neutral-400)]"
              >
                {copyState?.url === invoiceUrl
                  ? copyState.ok
                    ? 'Copied'
                    : 'Copy failed'
                  : 'Copy invoice URL'}
                <CopyOutlined className="!text-[20px]" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
