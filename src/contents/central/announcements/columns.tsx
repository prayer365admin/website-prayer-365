import ActionsTable from '@/components/common/actions-table'
import {
  AnnouncementPublishAction,
  AnnouncementStatusTag,
} from '@/contents/churches/announcements/columns'
import { AnnouncementListItem } from '@/models/announcement'
import { formatChurchInstant } from '@/utils/event-datetime'
import { TableProps, Typography } from 'antd'
import Link from 'next/link'

// Times render in each row's church timezone, matching the church announcements page.
export const CentralAnnouncementColumns = ({
  canPublish,
  publishingId,
  unpublishingId,
  onView,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
}: {
  canPublish?: boolean
  publishingId?: string
  unpublishingId?: string
  onView?: (announcement: AnnouncementListItem) => void
  onEdit: (announcement: AnnouncementListItem) => void
  onPublish?: (announcement: AnnouncementListItem) => Promise<unknown>
  onUnpublish?: (announcement: AnnouncementListItem) => Promise<unknown>
  onDelete: (announcement: AnnouncementListItem) => Promise<unknown>
}): TableProps<AnnouncementListItem>['columns'] => [
  {
    key: 'title',
    title: 'Title',
    sorter: true,
    render: (_, announcement) => (
      <span className="font-bold text-neutral-900">{announcement.title}</span>
    ),
  },
  {
    key: 'church',
    title: 'Church',
    render: (_, announcement) => (
      <Link href={`/dashboard/churches/${announcement.churchId}/announcements`}>
        {announcement.church.name}
      </Link>
    ),
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
        {announcement.publishedAt
          ? formatChurchInstant(announcement.publishedAt, announcement.church.timezone)
          : '—'}
      </span>
    ),
  },
  {
    key: 'created_at',
    title: 'Created at',
    sorter: true,
    defaultSortOrder: 'descend',
    render: (_, announcement) => (
      <span className="whitespace-nowrap">
        {formatChurchInstant(announcement.createdAt, announcement.church.timezone)}
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
        onView={onView ? () => onView(announcement) : undefined}
        onEdit={() => onEdit(announcement)}
        onDelete={() => void onDelete(announcement).catch(() => undefined)}
        extraActions={
          canPublish && onPublish && onUnpublish ? (
            <AnnouncementPublishAction
              announcement={announcement}
              publishingId={publishingId}
              unpublishingId={unpublishingId}
              onPublish={() => onPublish(announcement)}
              onUnpublish={() => onUnpublish(announcement)}
            />
          ) : undefined
        }
      />
    ),
  },
]
