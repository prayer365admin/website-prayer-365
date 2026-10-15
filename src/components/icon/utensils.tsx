'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 2V6C4 7.1 4.9 8 6 8V18H7.5V8C8.6 8 9.5 7.1 9.5 6V2H8V5H7V2H6.5V5H5.5V2H4ZM13.5 2C12.1 2 11 3.1 11 4.5V10H12.5V18H14V2H13.5Z"
      fill="currentColor"
    />
  </svg>
)

export const UtensilsIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
