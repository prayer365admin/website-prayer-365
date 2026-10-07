import ActionsTable from '@/components/common/actions-table'
import { VoiceProfileListItem } from '@/models/voice'
import { ACTION_COLUMN_WIDTH, ADDITIONAL_COLUMN_CONFIG } from '@/utils/constant'
import { TableProps } from 'antd'
import { useRouter } from 'next/navigation'
import { formatDate } from './central-review-detail'
import { registrationLabel, reviewLabel } from './status'

/**
 * S24 voice submissions table. Column keys are the API `order_by` values, so a
 * sorted column maps straight to the server sort. The edit button opens the
 * profile's own page, which enforces review permissions itself.
 */
export const VoiceProfileColumns = () => {
  const router = useRouter()
  const columns: TableProps<VoiceProfileListItem>['columns'] = [
    {
      key: 'pastor_name',
      title: 'Pastor',
      sorter: true,
      render: (_, p) => <span className="font-medium">{p.pastorName}</span>,
    },
    { key: 'church_name', title: 'Church', sorter: true, render: (_, p) => p.churchName },
    {
      key: 'submitted_at',
      title: 'Submitted',
      sorter: true,
      render: (_, p) => formatDate(p.submittedAt),
    },
    { key: 'samples', title: 'Samples', sorter: true, render: (_, p) => p.samples.length },
    {
      key: 'review_state',
      title: 'Admin review',
      sorter: true,
      render: (_, p) => reviewLabel(p.reviewState),
    },
    {
      key: 'reviewed_by',
      title: 'Reviewed by',
      sorter: true,
      render: (_, p) => p.reviewedByName ?? '—',
    },
    {
      key: 'registration_state',
      title: 'Registration',
      sorter: true,
      render: (_, p) => registrationLabel(p.registrationState),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: ACTION_COLUMN_WIDTH,
      ...ADDITIONAL_COLUMN_CONFIG,
      render: (_, p) => (
        <ActionsTable
          entity="voice profile"
          details={p.pastorName}
          actions="reviewing"
          onEdit={() => router.push(`/dashboard/central/voice-profiles/${p.id}`)}
        />
      ),
    },
  ]
  return columns
}
