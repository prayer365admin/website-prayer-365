'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4.5 4V6H9.5V4C9.5 2.625 8.375 1.5 7 1.5C5.59375 1.5 4.5 2.625 4.5 4ZM3 6V4C3 1.8125 4.78125 0 7 0C9.1875 0 11 1.8125 11 4V6H12.5H14V7.5V14.5V16H12.5H1.5H0V14.5V7.5V6H1.5H3ZM1.5 14.5H12.5V7.5H1.5V14.5Z"
      fill="currentColor"
    />
  </svg>
)

export const LockIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
