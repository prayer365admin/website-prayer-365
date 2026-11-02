'use client'

import SiteButton from '@/components/common/button'
import RichTextContent from '@/components/common/rich-text-content'
import { ChurchPastorSummary } from '@/models/pastor'
import { PrayerOutput } from '@/models/prayer'
import { CheckCircleOutlined, CheckOutlined } from '@ant-design/icons'
import { Col, Drawer, Row } from 'antd'
import styles from '../editor.module.scss'

export default function PrayerReviewDrawer({
  approveLoading,
  onApprove,
  onClose,
  open,
  pastors,
  saved,
}: {
  approveLoading: boolean
  onApprove: () => Promise<void>
  onClose: () => void
  open: boolean
  pastors?: ChurchPastorSummary[]
  saved: PrayerOutput | null
}) {
  return (
    <Drawer
      closable={{ placement: 'end' }}
      rootClassName={styles.reviewDrawer}
      title="Review text for audio"
      open={open}
      onClose={onClose}
      size={640}
      footer={
        <div className={styles.drawerFooter}>
          <SiteButton size="md" variant="outlined" onClick={onClose}>
            Cancel
          </SiteButton>
          {saved?.current && !saved.textApproved && (
            <SiteButton
              icon={<CheckOutlined aria-hidden className={styles.editorIcon} />}
              iconPlacement="end"
              loading={approveLoading}
              size="md"
              onClick={onApprove}
            >
              Approve text for audio
            </SiteButton>
          )}
        </div>
      }
    >
      {saved?.current && (
        <div className={styles.reviewContent}>
          <div className={styles.reviewField}>
            <div className={styles.reviewFieldTitle}>Title</div>
            <div className={styles.reviewFieldValue}>{saved.current.title}</div>
          </div>
          <div className={styles.reviewField}>
            <div className={styles.reviewFieldTitle}>Introduction</div>
            <div className={styles.reviewFieldValue}>
              {saved.current.introduction ? (
                <RichTextContent html={saved.current.introduction} />
              ) : (
                '—'
              )}
            </div>
          </div>
          <div className={styles.reviewField}>
            <div className={styles.reviewFieldTitle}>Full prayer text</div>
            <div className={styles.reviewFieldValue}>
              <RichTextContent html={saved.current.body} />
            </div>
          </div>
          <Row gutter={16}>
            <Col className={styles.reviewField} span={12}>
              <div className={styles.reviewFieldTitle}>Pastor</div>
              <div className={styles.reviewFieldValue}>
                {pastors?.find((pastor) => pastor.id === saved.current?.pastorId)?.name ||
                  saved.current.pastorId}
              </div>
            </Col>
            <Col className={styles.reviewField} span={12}>
              <div className={styles.reviewFieldTitle}>Content language</div>
              <div className={styles.reviewFieldValue}>{saved.current.languageCode}</div>
            </Col>
          </Row>
          <div className={styles.reviewField}>
            <div className={styles.reviewFieldTitle}>Version</div>
            <div className={styles.reviewFieldValue}>{saved.current.versionNumber}</div>
          </div>

          {saved.textApproved && (
            <div className={styles.reviewApprovalBanner} role="status">
              <CheckCircleOutlined aria-hidden />
              <span>
                Text approved
                {saved.current.approvedByName ? ` by ${saved.current.approvedByName}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
