import { PrayerOutput } from '@/models/prayer'
import { ADDITIONAL_COLUMN_CONFIG } from '@/utils/constant'
import { DeleteFilled, EditFilled, HistoryOutlined } from '@ant-design/icons'
import { Button, TableProps, Tooltip } from 'antd'
import styles from './index.module.scss'

export type CentralPrayerRow = PrayerOutput & { churchName: string }

const publishedDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))

const prayerState = (record: CentralPrayerRow) => {
  if (record.published) return 'Published'
  if (record.scheduled) return 'Scheduled'
  return 'Draft'
}

export const CentralPrayerColumns = ({
  onOpen,
  page,
  pageSize,
}: {
  onOpen: (churchId: string, prayerId: string) => void
  page: number
  pageSize: number
}) => {
  const columns: TableProps<CentralPrayerRow>['columns'] = [
    {
      key: 'number',
      title: 'No.',
      width: 1,
      render: (_value, _record, index) => (page - 1) * pageSize + index + 1,
    },
    {
      key: 'title',
      title: 'Title',
      render: (_value, record) => (
        <span className={styles.prayerTitle}>{record.current?.title ?? 'Untitled prayer'}</span>
      ),
    },
    {
      key: 'church',
      title: 'Church',
      render: (_value, record) => record.churchName,
    },
    {
      key: 'status',
      title: 'Status',
      render: (_value, record) => {
        const state = prayerState(record)
        return (
          <span className={`${styles.statusPill} ${styles[`status${state}`]}`}>
            <span aria-hidden="true" className={styles.statusDot} />
            {state}
          </span>
        )
      },
    },
    {
      key: 'published_at',
      title: 'Published at',
      sorter: true,
      render: (_value, record) =>
        record.published ? publishedDate(record.published.publishedAt) : '—',
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 100,
      ...ADDITIONAL_COLUMN_CONFIG,
      render: (_value, record) => (
        <div className={styles.actionButtons}>
          <Tooltip title="Prayer history is not available yet">
            <span>
              <Button
                aria-label={`View history for ${record.current?.title ?? 'prayer'}`}
                className={styles.neutralActionButton}
                disabled
                icon={<HistoryOutlined />}
              />
            </span>
          </Tooltip>
          <Tooltip title="Edit prayer">
            <Button
              aria-label={`Edit ${record.current?.title ?? 'prayer'}`}
              className={styles.neutralActionButton}
              icon={<EditFilled />}
              onClick={() => onOpen(record.churchId, record.id)}
            />
          </Tooltip>
          <Tooltip title="Prayer deletion is not available yet">
            <span>
              <Button
                aria-label={`Delete ${record.current?.title ?? 'prayer'}`}
                className={styles.deleteActionButton}
                disabled
                icon={<DeleteFilled />}
              />
            </span>
          </Tooltip>
        </div>
      ),
    },
  ]
  return columns
}
