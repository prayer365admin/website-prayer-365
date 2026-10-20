'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.59375 3.9375C1.5625 5.3125 1.8125 7.28125 2.625 9.21875C3.53125 11.25 5.03125 13.2188 7.59375 14.375C10.125 13.2188 11.625 11.25 12.5312 9.21875C13.375 7.28125 13.625 5.3125 13.5938 3.9375L7.59375 1.625L1.59375 3.9375ZM15.0625 3.53125C15.1562 5.09375 14.9062 7.5 13.9062 9.8125C12.875 12.1875 11.0625 14.5 7.96875 15.8438L7.59375 16L7.1875 15.8438C4.09375 14.5 2.28125 12.1875 1.25 9.8125C0.25 7.5 0 5.09375 0.09375 3.53125L0.125 2.90625L0.71875 2.65625L7.21875 0.15625L7.59375 0L7.9375 0.15625L14.4375 2.65625L15.0312 2.90625L15.0625 3.53125ZM11.125 6.53125L7.125 10.5312L6.59375 11.0625L6.0625 10.5312L4.0625 8.53125L3.53125 8L4.59375 6.96875L5.125 7.5L6.59375 8.96875L10.0625 5.5L10.5938 4.96875L11.6562 6L11.125 6.53125Z"
      fill="currentColor"
    />
  </svg>
)

export const ShieldCheckIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
