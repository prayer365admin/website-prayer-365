import { RequestListSummary } from '@/models/request'
import { TableProps, Tag } from 'antd'
import dayjs from 'dayjs'
import ActionsTable from '@/components/common/actions-table'

/*
 * Shared S10/S11 labels. Classification is not a workflow status (DESIGN S10):
 * pastoral/meeting requests are always "Restricted" (F7RQ R2), prayer requests
 * are "Private" or "Standard".
 */

export const REQUEST_KIND_LABELS: Record<string, string> = {
  prayer: 'Prayer request',
  pastoral: 'Pastoral request',
  meeting: 'Meeting request',
}

export const requestKindLabel = (kind: string) => REQUEST_KIND_LABELS[kind] ?? 'Request'

export const requestTitle = (r: { kind: string; subject: string | null }) =>
  r.subject?.trim() || requestKindLabel(r.kind)

export const requestClassificationLabel = (r: { kind: string; classification: string | null }) =>
  r.kind !== 'prayer' ? 'Restricted' : r.classification === 'private' ? 'Private' : 'Standard'

export const RequestClassificationTag = (r: { kind: string; classification: string | null }) => {
  const label = requestClassificationLabel(r)
  return <Tag color={label === 'Standard' ? undefined : 'gold'}>{label}</Tag>
}

export const requestsHref = (churchId: string) =>
  `/dashboard/churches/${encodeURIComponent(churchId)}/requests`

export const requestDetailHref = (churchId: string, requestId: string) =>
  `${requestsHref(churchId)}/${encodeURIComponent(requestId)}`

/** Viewer-local received time, e.g. "08 Oct 2026 14:05". */
export const formatReceived = (iso: string) => dayjs(iso).format('DD MMM YYYY HH:mm')

export const RequestColumns = ({
  onOpen,
}: {
  onOpen: (request: RequestListSummary) => void
}): TableProps<RequestListSummary>['columns'] => [
  {
    key: 'subject',
    title: 'Subject / type',
    render: (_, r) => (
      <div>
        <div>{requestTitle(r)}</div>
        {r.subject?.trim() && (
          <div className="text-xs text-gray-500">{requestKindLabel(r.kind)}</div>
        )}
      </div>
    ),
  },
  {
    key: 'classification',
    title: 'Classification',
    render: (_, r) => <RequestClassificationTag kind={r.kind} classification={r.classification} />,
  },
  {
    key: 'created_at',
    title: 'Received',
    sorter: true,
    defaultSortOrder: 'descend',
    sortDirections: ['descend', 'ascend', 'descend'],
    render: (_, r) => <span className="whitespace-nowrap">{formatReceived(r.createdAt)}</span>,
  },
  {
    key: 'actions',
    title: 'Actions',
    // Same action icon as the other church lists; it opens the read-only detail.
    // No delete: requests are view/contact only (D3).
    render: (_, r) => (
      <ActionsTable
        entity="request"
        details={requestTitle(r)}
        actions="opening"
        onEdit={() => onOpen(r)}
      />
    ),
  },
]
