import AddButton from '@/components/common/add-button'
import { Col, Row } from 'antd'
import Title from 'antd/es/typography/Title'
import { useRouter } from 'next/navigation'

export default function DashboardMainHeader({
  title,
  description,
  buttonLabel,
  url,
  buttonPermissionSubject,
  children,
  disabled,
}: {
  title: string
  description?: string
  buttonLabel?: string
  url?: string
  buttonPermissionSubject?: string
  children?: React.ReactNode
  disabled?: boolean
}) {
  const router = useRouter()
  const hasActions = Boolean(children || buttonPermissionSubject || (buttonLabel && url))

  return (
    <Row justify="space-between">
      <Col xs={24} lg={hasActions ? 10 : 24}>
        <Title className="!h-[40px] !mb-2" level={3}>
          {title}
        </Title>
        {description && <p className="!mt-0 !mb-5 text-gray-500">{description}</p>}
      </Col>
      <Col xs={24} lg={hasActions ? 14 : 0}>
        <Row gutter={[16, 8]} justify="end">
          {children}
          {(buttonPermissionSubject || (buttonLabel && url)) && (
            <Col>
              <AddButton
                label={buttonLabel ?? 'Add'}
                onClick={() => router.push(url ?? '')}
                permissionSubject={buttonPermissionSubject}
                disabled={disabled}
              />
            </Col>
          )}
        </Row>
      </Col>
    </Row>
  )
}
