'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 19 11" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M18.4088 6.05L14.0088 10.45L13.4588 11L12.3912 9.9L12.9412 9.35L16.0147 6.27647H0V4.72353H16.0147L12.9412 1.65L12.3912 1.1L13.4588 0L14.0088 0.55L18.4088 4.95L18.9588 5.5L18.4088 6.05Z"
      fill="currentColor"
    />
  </svg>
)

export const ArrowRightIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
export const LongArrowRightIcon = ArrowRightIcon
