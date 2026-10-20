'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14 6.25C14 8.34375 12.3125 10 10.25 10H9.75H9V8.5H9.75H10.25C11.4688 8.5 12.5 7.5 12.5 6.25V6H9.5H8V4.5V1.5V0H9.5H12.5H14V1.5V3V4.5V6V6.25ZM12.5 4.5V3V1.5H9.5V4.5H12.5ZM1.5 4.5H4.5V3V1.5H1.5V4.5ZM6 3V4.5V6V6.25C6 8.34375 4.3125 10 2.25 10H1.75H1V8.5H1.75H2.25C3.46875 8.5 4.5 7.5 4.5 6.25V6H1.5H0V4.5V1.5V0H1.5H4.5H6V1.5V3Z"
      fill="currentColor"
    />
  </svg>
)

export const QuoteIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
