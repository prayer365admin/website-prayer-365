'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

// Font Awesome: ellipsis-vertical / ellipsis-v (solid)
const IconSvg = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 128 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112z"
      fill="currentColor"
    />
  </svg>
)

export const EllipsisVIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export default EllipsisVIcon
