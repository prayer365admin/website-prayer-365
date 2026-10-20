'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15 8.5V17.5H6V8.5H15ZM19.5 17.5L15.75 14.9219V11.1016L19.5 8.5V17.5Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as SundayLivestreamIcon }
