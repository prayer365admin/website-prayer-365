import PastorImage from '@/components/common/pastor-image'
import { ChurchIcon } from '@/components/icon/church'
import { VerifyIcon } from '@/components/icon/verify'
import { VoiceProfileListItem } from '@/models/voice'
import { ADDITIONAL_COLUMN_CONFIG } from '@/utils/constant'
import { DeleteFilled, EditFilled } from '@ant-design/icons'
import { Button, TableProps, Tooltip } from 'antd'
import { useRouter } from 'next/navigation'
import { formatDate } from './central-review-detail'
import { registrationLabel, reviewLabel } from './status'

const reviewTone: Record<string, string> = {
  APPROVED: 'border-[#D3FAEF] bg-[#EDFDF9] text-[#09A97C]',
  SUBMITTED: 'border-[#FBEEC6] bg-amber-50 text-[#D8A50E]',
  REJECTED: 'border-[#F8D4D4] bg-red-50 text-[#E54C4C]',
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-500',
}

const reviewDot: Record<string, string> = {
  APPROVED: 'bg-[#09A97C]',
  SUBMITTED: 'bg-[#D8A50E]',
  REJECTED: 'bg-[#E54C4C]',
  DRAFT: 'bg-slate-400',
}

const reviewDisplay = (state: string) => (state === 'SUBMITTED' ? 'Pending' : reviewLabel(state))

/** Central AI voice profile table matching the design while preserving safe disable semantics. */
export const VoiceProfileColumns = ({
  canDisable = false,
  onDisable,
  page = 1,
  pageSize = 10,
}: {
  canDisable?: boolean
  onDisable?: (profile: VoiceProfileListItem) => void
  page?: number
  pageSize?: number
} = {}) => {
  const router = useRouter()
  const columns: TableProps<VoiceProfileListItem>['columns'] = [
    {
      key: 'number',
      title: 'No.',
      width: 1,
      render: (_value, _profile, index) => (page - 1) * pageSize + index + 1,
    },
    {
      key: 'pastor_name',
      title: 'Pastor (Church)',
      sorter: true,
      render: (_, profile) => (
        <div className="flex min-w-[280px] items-center gap-2">
          <PastorImage
            imageAssetId={profile.pastorImageAssetId}
            churchId={profile.pastorImageChurchId}
            name={profile.pastorName}
            size={40}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold leading-[150%] text-[#0E203E]">
              <span className="truncate">{profile.pastorName}</span>
              <VerifyIcon
                className="shrink-0"
                style={{
                  color: 'var(--color-primary-500, #2F7AD2)',
                  backgroundColor: 'transparent',
                  fontSize: 14,
                  fontStyle: 'normal',
                  fontWeight: 400,
                  lineHeight: '20px',
                  letterSpacing: 0,
                  textAlign: 'center',
                }}
                aria-label="Verified pastor"
              />
            </div>
            <div className="flex items-center gap-1.5 truncate text-xs font-normal leading-[150%] text-[#8F96A3]">
              <ChurchIcon className="shrink-0" aria-hidden />
              <span className="truncate">{profile.churchName}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'submitted_at',
      title: 'Submitted',
      sorter: true,
      render: (_, profile) => (
        <span className="whitespace-nowrap">{formatDate(profile.submittedAt)}</span>
      ),
    },
    {
      key: 'samples',
      title: 'Samples',
      sorter: true,
      render: (_, profile) => <span>{profile.samples.length}</span>,
    },
    {
      key: 'review_state',
      title: 'Review',
      sorter: true,
      render: (_, profile) => (
        <span
          className={`inline-flex h-7 items-center justify-start gap-2 rounded-full border px-2.5 py-1 text-left text-xs font-semibold leading-[150%] ${reviewTone[profile.reviewState] ?? reviewTone.DRAFT}`}
        >
          <span
            className={`size-1.5 rounded-full ${reviewDot[profile.reviewState] ?? reviewDot.DRAFT}`}
          />
          {reviewDisplay(profile.reviewState)}
        </span>
      ),
    },
    {
      key: 'reviewed_by',
      title: 'Reviewed by',
      sorter: true,
      render: (_, profile) => <span>{profile.reviewedByName ?? '—'}</span>,
    },
    {
      key: 'registration_state',
      title: 'Registration',
      sorter: true,
      render: (_, profile) => <span>{registrationLabel(profile.registrationState)}</span>,
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 100,
      ...ADDITIONAL_COLUMN_CONFIG,
      render: (_, profile) => (
        <div className="flex justify-center gap-2">
          <Tooltip title="Review profile">
            <Button
              className="!size-8 !rounded !border-[#DDE0E4] !bg-white !p-2 !text-[#B0B6BF]"
              aria-label={`Review ${profile.pastorName}`}
              icon={<EditFilled style={{ fontSize: 10, lineHeight: '20px' }} />}
              onClick={() => router.push(`/dashboard/central/voice-profiles/${profile.id}`)}
            />
          </Tooltip>
          {canDisable && profile.registrationState !== 'DISABLED' && (
            <Tooltip
              title={
                profile.reviewState === 'APPROVED'
                  ? 'Disable voice'
                  : 'Only approved voices can be disabled'
              }
            >
              <Button
                danger
                type="primary"
                className="!size-8 !rounded !border-[#E54C4C] !bg-[#E54C4C] !p-2 !text-white disabled:!border-[#DDE0E4] disabled:!bg-[#F9FAFB] disabled:!text-[#8F96A3]"
                aria-label={`Disable ${profile.pastorName}`}
                disabled={profile.reviewState !== 'APPROVED'}
                icon={<DeleteFilled style={{ fontSize: 10, lineHeight: '20px' }} />}
                onClick={() => onDisable?.(profile)}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ]
  return columns
}
