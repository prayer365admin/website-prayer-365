'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7.53125 10.7812L7 11.3125L6.46875 10.7812L2.46875 6.78125L1.9375 6.25L3 5.21875L3.53125 5.75L6.25 8.46875V0.75V0H7.75V0.75V8.46875L10.4688 5.75L11 5.21875L12.0312 6.25L11.5 6.78125L7.53125 10.7812ZM1.5 10.75V14.5H12.5V10.75V10H14V10.75V15.25V16H13.25H0.75H0V15.25V10.75V10H1.5V10.75Z"
      fill="currentColor"
    />
  </svg>
)

export const ArrowDownBracketIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
export const DownloadIcon = ArrowDownBracketIcon
