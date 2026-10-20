'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.65402 4.64286C2.46652 1.97321 4.96205 0 7.89286 0H10.6786V1.39286H7.89286C5.71652 1.39286 3.88839 2.72768 3.13393 4.64286H8.125V6.03571H2.81473C2.78571 6.1808 2.78571 6.35491 2.78571 6.5C2.78571 6.64509 2.78571 6.8192 2.81473 6.96429H8.125V8.35714H3.13393C3.88839 10.2723 5.71652 11.6071 7.89286 11.6071H10.6786V13H7.89286C4.96205 13 2.46652 11.0558 1.65402 8.35714H0V6.96429H1.42188C1.39286 6.67411 1.39286 6.35491 1.42188 6.03571H0V4.64286H1.65402Z"
      fill="currentColor"
    />
  </svg>
)

export const EuroIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
