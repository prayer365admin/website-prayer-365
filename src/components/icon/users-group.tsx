'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7 8C8.66 8 10 6.66 10 5C10 3.34 8.66 2 7 2C5.34 2 4 3.34 4 5C4 6.66 5.34 8 7 8ZM7 9.5C4.67 9.5 0 10.67 0 13V15H14V13C14 10.67 9.33 9.5 7 9.5ZM13 8C14.66 8 16 6.66 16 5C16 3.34 14.66 2 13 2C12.3 2 11.66 2.24 11.13 2.65C11.68 3.33 12 4.12 12 5C12 5.88 11.68 6.67 11.13 7.35C11.66 7.76 12.3 8 13 8ZM15.5 10.2C16.98 10.83 18 11.85 18 13V15H15.5V13.5C15.5 12.22 14.88 11.08 13.9 10.3C14.47 10.19 15.01 10.15 15.5 10.2Z"
      fill="currentColor"
    />
  </svg>
)

export const UsersGroupIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
