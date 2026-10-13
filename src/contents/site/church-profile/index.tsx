'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import axios from 'axios'
import Image from 'next/image'
import { Alert, Button, Card, Skeleton, Typography } from 'antd'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useSiteChurchProfile } from '@/hooks/data/site/churches'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <Typography.Text strong className="mb-1 block">
        {label}
      </Typography.Text>
      <div>{children}</div>
    </div>
  )
}

export default function ContentsSiteChurchProfile({ churchId }: { churchId: string }) {
  const { t } = useSiteI18n()
  const { data, loading, error, retry } = useSiteChurchProfile(churchId)

  const is404 = axios.isAxiosError(error) && error.response?.status === 404

  const hasAddress = Boolean(
    data?.address &&
      (data.address.line1 ||
        data.address.line2 ||
        data.address.postalCode ||
        data.address.city ||
        data.address.countryCode),
  )

  const hasContacts = Boolean(data?.contacts && (data.contacts.email || data.contacts.phone))

  return (
    <div className="mx-auto max-w-4xl p-6">
      {loading && (
        <Card>
          <Skeleton active />
        </Card>
      )}

      {error &&
        !loading &&
        (is404 ? (
          <Typography.Text>{t('churchNotFound')}</Typography.Text>
        ) : (
          <Alert
            type="error"
            message={t('error')}
            action={<Button onClick={() => retry()}>Retry</Button>}
          />
        ))}

      {!loading && !error && data && (
        <Card
          cover={
            data.coverUrl ? (
              <Image
                src={data.coverUrl}
                alt={data.name}
                width={800}
                height={200}
                className="h-[200px] w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-[200px] items-center justify-center bg-gray-100 text-4xl font-bold">
                {data.name.charAt(0)}
              </div>
            )
          }
        >
          <Typography.Title level={2}>{data.name}</Typography.Title>
          {data.denomination && (
            <div>
              <Typography.Text type="secondary">{data.denomination}</Typography.Text>
            </div>
          )}
          {data.address?.city && <div>{data.address.city}</div>}

          <Section label={t('serviceTimes')}>
            <div className="mb-2">
              <Typography.Text type="secondary">{data.timezone}</Typography.Text>
            </div>
            {data.serviceTimes?.map((st, i) => (
              <div key={i}>
                <span>
                  {WEEKDAYS[st.weekday - 1]} {st.localTime}
                </span>
                {st.label && (
                  <span>
                    {' — '}
                    <span>{st.label}</span>
                  </span>
                )}
              </div>
            ))}
          </Section>

          {data.description && (
            <Section label={t('description')}>
              <p className="whitespace-pre-wrap">{data.description}</p>
            </Section>
          )}

          {hasAddress && (
            <Section label={t('address')}>
              {data.address.line1 && <div>{data.address.line1}</div>}
              {data.address.line2 && <div>{data.address.line2}</div>}
              {(data.address.postalCode || data.address.city) && (
                <div>{[data.address.postalCode, data.address.city].filter(Boolean).join(' ')}</div>
              )}
              {data.address.countryCode && <div>{data.address.countryCode}</div>}
            </Section>
          )}

          {hasContacts && (
            <Section label={t('contacts')}>
              {data.contacts.email && (
                <div>
                  <a
                    href={`mailto:${data.contacts.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {data.contacts.email}
                  </a>
                </div>
              )}
              {data.contacts.phone && (
                <div>
                  <a href={`tel:${data.contacts.phone}`} className="text-blue-600 hover:underline">
                    {data.contacts.phone}
                  </a>
                </div>
              )}
            </Section>
          )}

          {data.website && (
            <Section label={t('website')}>
              <a
                href={data.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {data.website}
              </a>
            </Section>
          )}

          {data.languageCodes && data.languageCodes.length > 0 && (
            <Section label={t('languages')}>
              <div>{data.languageCodes.join(', ')}</div>
            </Section>
          )}

          {data.accessibility && (
            <Section label={t('accessibility')}>
              <div>{data.accessibility}</div>
            </Section>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="primary" disabled>
              {t('donate')}
            </Button>
            <Typography.Text type="secondary">{t('donationsNotReady')}</Typography.Text>
            <Link href={`/churches/${churchId}/prayers`}>
              <Button>{t('viewPrayers')}</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
