'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9 1.5L9.75 0L10.5 1.5L12 2.25L10.5 3L9.75 4.5L9 3L7.5 2.25L9 1.5ZM3 4.5L4.5 1.5L6 4.5L9 6L6 7.5L4.5 10.5L3 7.5L0 6L3 4.5ZM9.75 7.5L10.5 9L12 9.75L10.5 10.5L9.75 12L9 10.5L7.5 9.75L9 9L9.75 7.5Z"
      fill="currentColor"
    />
  </svg>
)

export const SparklesIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
