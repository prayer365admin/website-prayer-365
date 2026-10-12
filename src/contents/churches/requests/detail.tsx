'use client'

import CardTitle from '@/components/common/card-title'
import { useRequest } from '@/hooks/data/request'
import { RequestOutput } from '@/models/request'
import { MailOutlined, PhoneOutlined } from '@ant-design/icons'
import { Alert, Breadcrumb, Button, Card, Col, Result, Row } from 'antd'
import Link from 'next/link'
import {
  RequestClassificationTag,
  formatReceived,
  requestKindLabel,
  requestTitle,
  requestsHref,
} from './columns'

/*
 * S11 request detail (F7RQ RQ-05). Shows the submitted message and the
 * sender's contact preferences. Contact opens the external mail/phone app
 * only for values the sender supplied; no in-app reply or booking (D3).
 * A 404 reads the same for "missing" and "not permitted" so existence of
 * a private request is never revealed.
 */

const NOT_SUPPLIED = 'Not supplied'

const mailHref = (email: string) => `mailto:${encodeURIComponent(email.trim())}`
// tel: accepts digits and a leading +; drop spaces, dashes and anything else.
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function ContactActions({ request }: { request: RequestOutput }) {
  const email = request.email?.trim()
  const phone = request.phone?.trim()
  const prefersPhone = /phone|call|tel/i.test(request.contactMethod)
  const actions = [
    email && {
      key: 'email',
      label: 'Use supplied email',
      href: mailHref(email),
      icon: <MailOutlined />,
    },
    phone && {
      key: 'phone',
      label: 'Use supplied phone',
      href: telHref(phone),
      icon: <PhoneOutlined />,
    },
  ].filter(Boolean) as { key: string; label: string; href: string; icon: React.ReactNode }[]
  // The sender's preferred method goes first and is the primary action.
  if (prefersPhone) actions.reverse()

  if (actions.length === 0)
    return <p className="m-0 text-gray-500">No email or phone was supplied.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a, i) => (
        <Button key={a.key} type={i === 0 ? 'primary' : 'default'} href={a.href} icon={a.icon}>
          {a.label}
        </Button>
      ))}
    </div>
  )
}

function RequestDetail({ request, churchId }: { request: RequestOutput; churchId: string }) {
  const field = (label: string, value: string | null) => (
    <div>
      <span className="text-gray-500">{label}: </span>
      {value?.trim() || NOT_SUPPLIED}
    </div>
  )

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { title: <Link href={requestsHref(churchId)}>Back to Requests</Link> },
          { title: requestTitle(request) },
        ]}
      />

      <Card type="inner" title={requestKindLabel(request.kind)}>
        <div className="flex flex-wrap items-center gap-2">
          <RequestClassificationTag kind={request.kind} classification={request.classification} />
          <span className="text-gray-500">Received {formatReceived(request.createdAt)}</span>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card type="inner" title="Submitted message" className="h-full">
            {/* Plain text only: supplied content is never rendered as HTML. */}
            <p className="m-0 whitespace-pre-wrap break-words">{request.message}</p>
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card type="inner" title="Contact preferences" className="h-full">
            <div className="space-y-2">
              {field('Preferred method', request.contactMethod)}
              {field('Email', request.email)}
              {field('Phone', request.phone)}
              {field('Availability', request.availability)}
            </div>
            <div className="mt-4">
              <ContactActions request={request} />
            </div>
          </Card>
        </Col>
      </Row>

      <Alert type="info" title="No in-app reply, status assignment or confirmed meeting booking." />
    </div>
  )
}

export default function ContentsChurchRequestDetail({
  churchId,
  requestId,
}: {
  churchId: string
  requestId: string
}) {
  const { data, loading, error, notFound } = useRequest({ churchId, requestId })

  return (
    <Card
      title={<CardTitle title={data ? requestTitle(data) : 'Request'} />}
      loading={!data && !error && loading}
    >
      {data ? (
        <RequestDetail request={data} churchId={churchId} />
      ) : notFound ? (
        <Result
          status="404"
          title="Request not available"
          subTitle="It may not exist, or you may not have access to it."
          extra={<Link href={requestsHref(churchId)}>Back to Requests</Link>}
        />
      ) : error ? (
        <Result status="error" title="The request could not be loaded" />
      ) : null}
    </Card>
  )
}
