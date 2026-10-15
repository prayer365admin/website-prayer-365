'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 3.3C8.6 1.7 6.1 1.7 4.7 3.1C3.3 4.5 3.3 6.8 4.7 8.2L10 13.5L15.3 8.2C16.7 6.8 16.7 4.5 15.3 3.1C13.9 1.7 11.4 1.7 10 3.3Z"
      fill="currentColor"
    />
    <path
      d="M2 13.5C2 12.7 2.7 12 3.5 12H7.2C8 12 8.7 12.4 9.1 13L10.5 15.1C10.9 15.7 11.6 16 12.3 16H15.5C16.3 16 17 15.3 17 14.5C17 13.7 16.3 13 15.5 13H14V11.5H15.5C17.2 11.5 18.5 12.8 18.5 14.5C18.5 16.2 17.2 17.5 15.5 17.5H12.3C11.1 17.5 10 17 9.3 16L8.4 14.7C8.2 14.4 7.9 14.2 7.5 14.2H3.5C2.7 14.2 2 13.9 2 13.5Z"
      fill="currentColor"
    />
  </svg>
)

export const HandHeartIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
