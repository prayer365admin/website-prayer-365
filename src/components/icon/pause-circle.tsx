'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14.5 8.34375C14.5 6.03125 13.25 3.90625 11.25 2.71875C9.21875 1.5625 6.75 1.5625 4.75 2.71875C2.71875 3.90625 1.5 6.03125 1.5 8.34375C1.5 10.6875 2.71875 12.8125 4.75 14C6.75 15.1562 9.21875 15.1562 11.25 14C13.25 12.8125 14.5 10.6875 14.5 8.34375ZM0 8.34375C0 5.5 1.5 2.875 4 1.4375C6.46875 0 9.5 0 12 1.4375C14.4688 2.875 16 5.5 16 8.34375C16 11.2188 14.4688 13.8438 12 15.2812C9.5 16.7188 6.46875 16.7188 4 15.2812C1.5 13.8438 0 11.2188 0 8.34375ZM7 6.09375V10.5938V11.3438H5.5V10.5938V6.09375V5.34375H7V6.09375ZM10.5 6.09375V10.5938V11.3438H9V10.5938V6.09375V5.34375H10.5V6.09375Z"
      fill="currentColor"
    />
  </svg>
)

export const PauseCircleIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
