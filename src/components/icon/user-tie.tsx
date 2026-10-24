'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6.125 7C4.86719 7 3.71875 6.34375 3.08984 5.25C2.46094 4.18359 2.46094 2.84375 3.08984 1.75C3.71875 0.683594 4.86719 0 6.125 0C7.35547 0 8.50391 0.683594 9.13281 1.75C9.76172 2.84375 9.76172 4.18359 9.13281 5.25C8.50391 6.34375 7.35547 7 6.125 7ZM5.71484 9.84375L4.8125 8.3125H6.125H7.4375L6.50781 9.84375L7.4375 13.2344L8.53125 8.75H10.5L12.25 14H7.65625H7.24609H4.97656H4.59375H0L1.75 8.75H3.69141L4.78516 13.2344L5.71484 9.84375Z"
      fill="currentColor"
    />
  </svg>
)

export const UserTieIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} style={{ color: '#2F7AD2', ...props.style }} {...props} />
)
