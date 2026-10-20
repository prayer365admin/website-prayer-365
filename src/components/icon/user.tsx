'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 14 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9.5 4.15625C9.5 3.28125 9 2.46875 8.25 2C7.46875 1.5625 6.5 1.5625 5.75 2C4.96875 2.46875 4.5 3.28125 4.5 4.15625C4.5 5.0625 4.96875 5.875 5.75 6.34375C6.5 6.78125 7.46875 6.78125 8.25 6.34375C9 5.875 9.5 5.0625 9.5 4.15625ZM3 4.15625C3 2.75 3.75 1.4375 5 0.71875C6.21875 0 7.75 0 9 0.71875C10.2188 1.4375 11 2.75 11 4.15625C11 5.59375 10.2188 6.90625 9 7.625C7.75 8.34375 6.21875 8.34375 5 7.625C3.75 6.90625 3 5.59375 3 4.15625ZM2.03125 14.6562H11.9688L10.875 11.1562H3.09375L2.03125 14.6562ZM2 9.65625H12L13.5312 14.6562L14 16.1562H12.4062H1.5625H0L0.4375 14.6562L2 9.65625Z"
      fill="currentColor"
    />
  </svg>
)

export const UserIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
