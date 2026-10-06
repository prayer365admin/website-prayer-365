import { EventCategory } from '@/models/event'
import { AlignType } from '@rc-component/table/es/interface'

export const ID_COLUMN_WIDTH = 80
export const ACTION_COLUMN_WIDTH = 125
export const ADDITIONAL_COLUMN_CONFIG: { align: AlignType; ellipsis: boolean } = {
  align: 'center',
  ellipsis: true,
}

export const categoryLabels: Record<EventCategory, string> = {
  SERVICE: 'Service',
  SPECIAL: 'Special',
  BIBLE_STUDY: 'Bible study',
  COMMUNITY: 'Community',
  OTHER: 'Other',
}

export const categoryColors: Record<EventCategory, string> = {
  SERVICE: 'blue',
  SPECIAL: 'purple',
  BIBLE_STUDY: 'geekblue',
  COMMUNITY: 'green',
  OTHER: 'default',
}
