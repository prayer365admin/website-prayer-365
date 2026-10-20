'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-trash.svg.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M8.3125 2.3125H12.6875L13.3438 4.0625H16.625V5.375H4.375V4.0625H7.65625L8.3125 2.3125ZM5.90625 16.75L5.16797 6.6875H6.48047L7.13672 15.4375H13.8633L14.5195 6.6875H15.832L15.0938 16.75H5.90625Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as TrashIcon }
