import { GeneralPrayerOutput } from '@/models/general-prayer'
import { ADDITIONAL_COLUMN_CONFIG } from '@/utils/constant'
import { EditFilled } from '@ant-design/icons'
import { Button, TableProps, Tooltip } from 'antd'
import Link from 'next/link'

export type GeneralPrayerRow = GeneralPrayerOutput

const audioStatusLabels: Record<string, string> = {
  QUEUED: 'Queued',
  GENERATING: 'Generating',
  READY: 'Ready',
  FAILED: 'Failed',
}

const audioStatusClass: Record<string, string> = {
  QUEUED: 'bg-[#edf4ff] border-[#dce9fb] text-[#1758a6]',
  GENERATING: 'bg-[#edf4ff] border-[#dce9fb] text-[#1758a6]',
  READY: 'bg-[#edfdf9] border-[#d3faef] text-[#09a97c]',
  FAILED: 'bg-[#fdf0ef] border-[#f8c9c9] text-[#d12920]',
}

const updatedAtFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export const GeneralPrayerColumns = ({
  page,
  pageSize,
  onOpen,
}: {
  page: number
  pageSize: number
  onOpen: (generalPrayerId: string) => void
}): TableProps<GeneralPrayerRow>['columns'] => [
  {
    key: 'sequence',
    title: 'No.',
    width: 1,
    render: (_value, _record, index) => (
      <span className="font-semibold text-neutral-700">{(page - 1) * pageSize + index + 1}</span>
    ),
  },
  {
    key: 'title',
    title: 'Title',
    render: (_value, record) => (
      <span className="font-bold text-neutral-900">
        <Link
          className="text-inherit hover:underline"
          href={`/dashboard/central/general-prayers/${record.id}`}
          onClick={() => onOpen(record.id)}
        >
          {record.title}
        </Link>
      </span>
    ),
  },
  {
    key: 'language',
    title: 'Language',
    width: 90,
    render: (_value, record) => (
      <span className="whitespace-nowrap uppercase">{record.languageCode}</span>
    ),
  },
  {
    key: 'audio_status',
    title: 'Audio',
    width: 130,
    render: (_value, record) => {
      const status = audioStatusLabels[record.audioStatus] ?? record.audioStatus
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold leading-none w-fit self-start shrink-0 ${
            audioStatusClass[record.audioStatus] ?? 'bg-[#f0f2f5] border-[#dde0e4] text-[#5c6370]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          {status}
        </span>
      )
    },
  },
  {
    key: 'is_active',
    title: 'Active',
    width: 90,
    render: (_value, record) =>
      record.isActive ? (
        <span className="text-[13px] font-semibold text-[#09a97c]">Active</span>
      ) : (
        <span className="text-[13px] font-semibold text-[#8f96a3]">Inactive</span>
      ),
  },
  {
    key: 'updated_at',
    title: 'Updated',
    width: 160,
    ...ADDITIONAL_COLUMN_CONFIG,
    render: (_value, record) => (
      <span className="whitespace-nowrap text-[13px] text-neutral-600">
        {record.updatedAt ? updatedAtFormat.format(new Date(record.updatedAt)) : '—'}
      </span>
    ),
  },
  {
    key: 'actions',
    title: 'Actions',
    width: 100,
    ...ADDITIONAL_COLUMN_CONFIG,
    render: (_value, record) => (
      <Tooltip title="Edit prayer">
        <Button
          aria-label={`Edit ${record.title}`}
          className="!size-8 !rounded-lg !border-[#DDE0E4] !bg-white !p-0 !text-[#8F96A3] hover:!text-[#0E203E] hover:!border-[#B0B6BF] flex items-center justify-center"
          icon={<EditFilled style={{ fontSize: 13 }} />}
          onClick={() => onOpen(record.id)}
        />
      </Tooltip>
    ),
  },
]
