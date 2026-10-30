'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/Icon-align-left.svg.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.03125 3.84375H12.25V5.15625H4.375V3.84375H5.03125ZM5.03125 7.34375H16.625V8.65625H4.375V7.34375H5.03125ZM4.375 10.8438H12.25V12.1562H4.375V10.8438ZM5.03125 14.3438H16.625V15.6562H4.375V14.3438H5.03125Z"
      fill="currentColor"
    />
  </svg>
)

export const AlignLeftIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
