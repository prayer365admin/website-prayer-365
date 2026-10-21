'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="7.2" stroke="currentColor" strokeWidth="1.6" />
    <polygon points="8,2.5 10.8,7.2 8,13.5 5.2,8.8" fill="currentColor" opacity="0.3" />
    <polygon points="8,2.5 10.8,7.2 8,8" fill="currentColor" />
  </svg>
)

export const CompassIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
