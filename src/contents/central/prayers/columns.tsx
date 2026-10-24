import { PrayerOutput } from '@/models/prayer'
import { ACTION_COLUMN_WIDTH, ADDITIONAL_COLUMN_CONFIG, ID_COLUMN_WIDTH } from '@/utils/constant'
import { Button, TableProps } from 'antd'

/** Central prayer row: the church name matters here, the per-church list omits it. */
export type CentralPrayerRow = PrayerOutput & { churchName: string }

export const CentralPrayerColumns = ({
  onOpen,
}: {
  onOpen: (churchId: string, prayerId: string) => void
}) => {
  const column: TableProps<CentralPrayerRow>['columns'] = [
    {
      key: 'no',
      title: 'No.',
      width: ID_COLUMN_WIDTH,
      render: (_text, _record, index) => (index + 1).toString().padStart(2, '0'),
    },
    {
      key: 'church',
      title: 'Church',
      render: (_text, record) => record.churchName,
    },
    {
      key: 'title',
      title: 'Title',
      render: (_text, record) => record.current?.title ?? '-',
    },
    {
      key: 'publication',
      title: 'Publication information',
      render: (_text, record) => {
        if (record.scheduled)
          return `Scheduled • ${new Date(record.scheduled.scheduledAt).toLocaleString()}`
        if (record.published)
          return `Published • ${new Date(record.published.publishedAt).toLocaleDateString()}`
        return 'Draft'
      },
    },
    {
      key: 'actions',
      title: 'Action',
      width: ACTION_COLUMN_WIDTH,
      ...ADDITIONAL_COLUMN_CONFIG,
      render: (_text, record) => (
        <Button type="link" size="small" onClick={() => onOpen(record.churchId, record.id)}>
          Open
        </Button>
      ),
    },
  ]
  return column
}
