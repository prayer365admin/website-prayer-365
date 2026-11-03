import ActionsTable from '@/components/common/actions-table'
import { useConfirmModal } from '@/hooks/ui/confirm-modal'
import { AnnouncementOutput } from '@/models/announcement'
import { SendOutlined, UndoOutlined } from '@ant-design/icons'
import { Button, TableProps, Tooltip, Typography } from 'antd'
import { formatChurchInstant } from '@/utils/event-datetime'
import { ANNOUNCEMENT_STATUS, announcementStatusLabels } from '@/utils/constant'

export const AnnouncementStatusTag = ({ publishedAt }: { publishedAt: string | null }) =>
  publishedAt ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#edfdf9] border border-[#d3faef] text-[#09a97c] text-xs font-semibold leading-none w-fit self-start shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-[#09a97c] shrink-0" />
      {announcementStatusLabels[ANNOUNCEMENT_STATUS.PUBLISHED]}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f0f2f5] border border-[#dde0e4] text-[#5c6370] text-xs font-semibold leading-none w-fit self-start shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-[#9aa1ad] shrink-0" />
      {announcementStatusLabels[ANNOUNCEMENT_STATUS.DRAFT]}
    </span>
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
}) => {
  const confirmUnpublish = useConfirmModal({
    entity: 'ANNOUNCEMENT',
    actions: 'UNPUBLISHING',
    details: announcement.title,
    description: 'This removes the announcement from the mobile app and returns it to Draft.',
    okText: 'Unpublish',
    cancelText: 'Cancel',
    onOk: () => onUnpublish(announcement),
  })

  const confirmPublish = useConfirmModal({
    entity: 'ANNOUNCEMENT',
    actions: 'PUBLISHING',
    details: announcement.title,
    description: 'This makes the announcement immediately visible in the mobile app.',
    okText: 'Publish now',
    cancelText: 'Cancel',
    onOk: () => onPublish(announcement),
  })

  return announcement.publishedAt ? (
    <Tooltip title="Unpublish">
      <Button
        className="!size-8 !rounded-lg !border-[#DDE0E4] !bg-white !p-0 !text-[#8F96A3] hover:!text-[#0E203E] hover:!border-[#B0B6BF] flex items-center justify-center"
        icon={<UndoOutlined style={{ fontSize: 13 }} />}
        loading={unpublishingId === announcement.id}
        disabled={Boolean(publishingId || unpublishingId)}
        aria-label={`Unpublish ${announcement.title}`}
        onClick={() => confirmUnpublish()}
      />
    </Tooltip>
  ) : (
    <Tooltip title="Publish">
      <Button
        className="!size-8 !rounded-lg !border-[#DDE0E4] !bg-white !p-0 !text-[#8F96A3] hover:!text-[#0E203E] hover:!border-[#B0B6BF] flex items-center justify-center"
        icon={<SendOutlined style={{ fontSize: 13 }} />}
        loading={publishingId === announcement.id}
        disabled={Boolean(publishingId || unpublishingId)}
        aria-label={`Publish ${announcement.title}`}
        onClick={() => confirmPublish()}
      />
    </Tooltip>
  )
}

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
