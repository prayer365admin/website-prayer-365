'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-location-plus.svg.
const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 12 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.5 6C10.5 3.53125 8.46875 1.5 6 1.5C3.5 1.5 1.5 3.53125 1.5 6C1.5 6.53125 1.71875 7.3125 2.25 8.375C2.78125 9.375 3.46875 10.4375 4.1875 11.4375C4.84375 12.3125 5.46875 13.0938 6 13.7188C6.5 13.0938 7.125 12.3125 7.78125 11.4375C8.5 10.4375 9.1875 9.375 9.71875 8.375C10.25 7.3125 10.5 6.53125 10.5 6ZM12 6C12 8.625 8.6875 12.8438 6.96875 14.875C6.375 15.5938 6 16 6 16C6 16 5.59375 15.5938 5 14.875C3.28125 12.8438 0 8.625 0 6C0 2.6875 2.6875 0 6 0C9.3125 0 12 2.6875 12 6ZM5.25 9.5V8.75V6.75H3.25H2.5V5.25H3.25H5.25V3.25V2.5H6.75V3.25V5.25H8.75H9.5V6.75H8.75H6.75V8.75V9.5H5.25Z"
      fill="currentColor"
    />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as LocationPlusIcon }
