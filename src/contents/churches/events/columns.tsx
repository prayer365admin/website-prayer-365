import ActionsTable from '@/components/common/actions-table'
import { EventOutput } from '@/models/event'
import { categoryColors, categoryLabels } from '@/utils/constant'
import { eventStartStatus, formatEventStart } from '@/utils/event-datetime'
import { ExportOutlined } from '@ant-design/icons'
import { Button, TableProps, Tag } from 'antd'

export const EventColumns = ({
  timezone,
  onEdit,
}: {
  timezone: string
  onEdit: (event: EventOutput) => void
}): TableProps<EventOutput>['columns'] => [
  {
    key: 'category',
    title: 'Category',
    render: (_, event) => (
      <Tag color={categoryColors[event.category]}>{categoryLabels[event.category]}</Tag>
    ),
  },
  {
    key: 'title',
    title: 'Title',
    render: (_, event) => event.title,
  },
  {
    key: 'starts_at',
    title: 'Starts',
    sorter: true,
    defaultSortOrder: 'descend',
    render: (_, event) => {
      const status = eventStartStatus(event.startsAt, timezone)
      return (
        <>
          {formatEventStart(event.startsAt, timezone)}
          {status && (
            <Tag color={status.color} className="!ml-2">
              {status.label}
            </Tag>
          )}
        </>
      )
    },
  },
  {
    key: 'timezone',
    title: 'Timezone',
    render: () => timezone,
  },
  {
    key: 'location',
    title: 'Location',
    render: (_, event) => event.location,
  },
  {
    key: 'language',
    title: 'Language',
    render: (_, event) => event.languageCode ?? '—',
  },
  {
    key: 'registration',
    title: 'Registration',
    render: (_, event) =>
      event.registrationUrl ? (
        <Button
          type="link"
          href={event.registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          icon={<ExportOutlined />}
          className="!px-0"
        >
          Open link
        </Button>
      ) : (
        '—'
      ),
  },
  {
    key: 'cta_label',
    title: 'Button Label',
    render: (_, event) =>
      event.ctaLabel ? (
        <Tag color="blue">{event.ctaLabel}</Tag>
      ) : (
        <span className="text-gray-400">Join Service (default)</span>
      ),
  },
  {
    key: 'actions',
    title: 'Actions',
    render: (_, event) => (
      <ActionsTable
        entity="event"
        details={event.title}
        actions="editing"
        permissionSubject="prayer_event"
        onEdit={() => onEdit(event)}
      />
    ),
  },
]
