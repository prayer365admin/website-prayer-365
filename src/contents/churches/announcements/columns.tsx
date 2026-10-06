import ActionsTable from '@/components/common/actions-table'
import { AnnouncementOutput } from '@/models/announcement'
import { SendOutlined } from '@ant-design/icons'
import { UndoOutlined } from '@ant-design/icons'
import { Button, Popconfirm, TableProps, Tag, Tooltip, Typography } from 'antd'
import { formatChurchInstant } from '@/utils/event-datetime'
import { ANNOUNCEMENT_STATUS, announcementStatusLabels } from '@/utils/constant'

export const AnnouncementStatusTag = ({ publishedAt }: { publishedAt: string | null }) =>
  publishedAt ? (
    <Tag color="green">{announcementStatusLabels[ANNOUNCEMENT_STATUS.PUBLISHED]}</Tag>
  ) : (
    <Tag>{announcementStatusLabels[ANNOUNCEMENT_STATUS.DRAFT]}</Tag>
  )

/** Publish/unpublish icon button with confirmation; shared by church and central tables. */
export const AnnouncementPublishAction = ({
  announcement,
  publishingId,
  unpublishingId,
  onPublish,
  onUnpublish,
}: {
  announcement: AnnouncementOutput
  publishingId?: string
  unpublishingId?: string
  onPublish: (announcement: AnnouncementOutput) => Promise<unknown>
  onUnpublish: (announcement: AnnouncementOutput) => Promise<unknown>
}) =>
  announcement.publishedAt ? (
    <Tooltip title="Unpublish">
      <Popconfirm
        title="Unpublish announcement?"
        description="This removes the announcement from the mobile app and returns it to Draft."
        okText="Unpublish"
        cancelText="Keep published"
        onConfirm={() => onUnpublish(announcement)}
      >
        <Button
          type="link"
          size="small"
          icon={<UndoOutlined />}
          loading={unpublishingId === announcement.id}
          disabled={Boolean(publishingId || unpublishingId)}
          aria-label={`Unpublish ${announcement.title}`}
          className="!p-0"
        />
      </Popconfirm>
    </Tooltip>
  ) : (
    <Tooltip title="Publish">
      <Popconfirm
        title="Publish announcement?"
        description="This makes the announcement immediately visible in the mobile app."
        okText="Publish now"
        cancelText="Keep draft"
        onConfirm={() => onPublish(announcement)}
      >
        <Button
          type="link"
          size="small"
          icon={<SendOutlined />}
          loading={publishingId === announcement.id}
          disabled={Boolean(publishingId || unpublishingId)}
          aria-label={`Publish ${announcement.title}`}
          className="!p-0"
        />
      </Popconfirm>
    </Tooltip>
  )

export const AnnouncementColumns = ({
  canPublish,
  publishingId,
  unpublishingId,
  timezone,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
}: {
  canPublish: boolean
  publishingId?: string
  unpublishingId?: string
  timezone: string
  onEdit: (announcement: AnnouncementOutput) => void
  onPublish: (announcement: AnnouncementOutput) => Promise<unknown>
  onUnpublish: (announcement: AnnouncementOutput) => Promise<unknown>
  onDelete: (announcement: AnnouncementOutput) => Promise<unknown>
}): TableProps<AnnouncementOutput>['columns'] => [
  {
    key: 'title',
    title: 'Title',
    sorter: true,
    render: (_, announcement) => announcement.title,
  },
  {
    key: 'message',
    title: 'Message',
    render: (_, announcement) => (
      <Typography.Paragraph className="!mb-0 max-w-xl" ellipsis={{ rows: 2 }}>
        {announcement.body}
      </Typography.Paragraph>
    ),
  },
  {
    key: 'status',
    title: 'Status',
    render: (_, announcement) => <AnnouncementStatusTag publishedAt={announcement.publishedAt} />,
  },
  {
    key: 'published_at',
    title: 'Published at',
    sorter: true,
    render: (_, announcement) => (
      <span className="whitespace-nowrap">
        {announcement.publishedAt ? formatChurchInstant(announcement.publishedAt, timezone) : '—'}
      </span>
    ),
  },
  {
    key: 'created_at',
    title: 'Created',
    sorter: true,
    defaultSortOrder: 'descend',
    render: (_, announcement) => (
      <span className="whitespace-nowrap">
        {formatChurchInstant(announcement.createdAt, timezone)}
      </span>
    ),
  },
  {
    key: 'actions',
    title: 'Actions',
    render: (_, announcement) => (
      <ActionsTable
        entity="announcement"
        details={announcement.title}
        actions="deleting"
        permissionSubject="prayer_announcement"
        onEdit={() => onEdit(announcement)}
        onDelete={() => void onDelete(announcement).catch(() => undefined)}
        extraActions={
          canPublish ? (
            <AnnouncementPublishAction
              announcement={announcement}
              publishingId={publishingId}
              unpublishingId={unpublishingId}
              onPublish={onPublish}
              onUnpublish={onUnpublish}
            />
          ) : undefined
        }
      />
    ),
  },
]
