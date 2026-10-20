'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M11.8125 10.5V11.375V11.8125H10.9375V11.375V10.5H10.0625V11.375V11.8125H9.1875V11.375V10.5H6.5625V11.375V11.8125H5.6875V11.375V10.5H4.8125V11.375V11.8125H3.9375V11.375V10.5H3.0625V11.375V11.8125H2.1875V11.375V10.5H1.3125V12.6875H12.6875V10.5H11.8125ZM1.3125 9.1875H12.6875V8.69531L9.89844 7.30078L9.1875 6.94531V6.125V5.25C9.1875 3.08984 7.41016 1.3125 5.25 1.3125C3.0625 1.3125 1.3125 3.08984 1.3125 5.25V9.1875ZM14 7.875V9.1875V9.84375V10.5V12.6875V14H12.6875H1.3125H0V12.6875V10.5V9.84375V9.1875V5.25C0 2.35156 2.35156 0 5.25 0C8.14844 0 10.5 2.35156 10.5 5.25V6.125L14 7.875Z"
      fill="currentColor"
    />
  </svg>
)

export const MusicIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
export const PianoIcon = MusicIcon
