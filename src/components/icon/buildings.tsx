'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.875 1.125H6.375V10.875H10.875V1.125ZM6.375 0H10.875H12V1.125V10.875V12H10.875H6.375H5.25V10.875V1.125V0H6.375ZM4.5 3V4.125H1.125V10.875H4.5V12H0.5625H0V11.4375V3.5625V3H0.5625H4.5ZM3.75 7.5V9H2.25V7.5H3.75ZM7.875 8.25V6.75H9.375V8.25H7.875ZM3.75 5.25V6.75H2.25V5.25H3.75ZM7.875 2.25H9.375V3.75H7.875V2.25ZM9.375 6H7.875V4.5H9.375V6Z"
      fill="currentColor"
    />
  </svg>
)

export const BuildingsIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
