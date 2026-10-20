'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.875 1.125H1.125V8.97656L1.26562 8.8125L2.95312 6.9375L3.35156 6.51562L3.77344 6.91406L4.54688 7.71094L6.65625 4.73438L7.10156 4.10156L7.57031 4.73438L10.5703 8.85938L10.875 9.28125V1.125ZM1.125 0H10.875H12V1.125V9.375V10.5H10.875H1.125H0V9.375V1.125V0H1.125ZM4.5 3.375C4.5 3.79688 4.26562 4.14844 3.9375 4.35938C3.58594 4.57031 3.14062 4.57031 2.8125 4.35938C2.46094 4.14844 2.25 3.79688 2.25 3.375C2.25 2.97656 2.46094 2.625 2.8125 2.41406C3.14062 2.20312 3.58594 2.20312 3.9375 2.41406C4.26562 2.625 4.5 2.97656 4.5 3.375Z"
      fill="currentColor"
    />
  </svg>
)

export const ImageIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
