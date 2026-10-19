'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2L11.5 6.5L16 8L11.5 9.5L10 14L8.5 9.5L4 8L8.5 6.5L10 2Z" fill="currentColor" />
    <path
      d="M15 13L15.75 15.25L18 16L15.75 16.75L15 19L14.25 16.75L12 16L14.25 15.25L15 13Z"
      fill="currentColor"
    />
    <path
      d="M4.5 13L5.1 14.9L7 15.5L5.1 16.1L4.5 18L3.9 16.1L2 15.5L3.9 14.9L4.5 13Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as SparklesIcon }
