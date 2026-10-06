import { PrayerOutput } from '@/models/prayer'
import { ID_COLUMN_WIDTH, ACTION_COLUMN_WIDTH, ADDITIONAL_COLUMN_CONFIG } from '@/utils/constant'
import { Button, TableProps } from 'antd'

export const PrayerColumns = ({ onOpen }: { onOpen: (prayerId: string) => void }) => {
  const column: TableProps<PrayerOutput>['columns'] = [
    {
      key: 'no',
      title: 'No.',
      width: ID_COLUMN_WIDTH,
      render: (_text, _record, index) => (index + 1).toString().padStart(2, '0'),
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
        <Button type="link" size="small" onClick={() => onOpen(record.id)}>
          Open
        </Button>
      ),
    },
  ]
  return column
}
