'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2 8.5C2 7.7 2.7 7 3.5 7C4.3 7 5 7.7 5 8.5V11.5C5 12.3 4.3 13 3.5 13C2.7 13 2 12.3 2 11.5V8.5ZM6.5 5.5C6.5 4.7 7.2 4 8 4C8.8 4 9.5 4.7 9.5 5.5V14.5C9.5 15.3 8.8 16 8 16C7.2 16 6.5 15.3 6.5 14.5V5.5ZM11 2.5C11 1.7 11.7 1 12.5 1C13.3 1 14 1.7 14 2.5V17.5C14 18.3 13.3 19 12.5 19C11.7 19 11 18.3 11 17.5V2.5ZM15.5 7C15.5 6.2 16.2 5.5 17 5.5C17.8 5.5 18.5 6.2 18.5 7V13C18.5 13.8 17.8 14.5 17 14.5C16.2 14.5 15.5 13.8 15.5 13V7Z"
      fill="currentColor"
    />
  </svg>
)

export const WaveformIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
