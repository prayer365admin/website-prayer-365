'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14.6667 1.33333H1.33333V2.66667H14.6667V1.33333ZM14.6667 5.33333H1.33333V11.1111H14.6667V5.33333ZM1.33333 0H14.6667H16V1.33333V11.1111V12.4444H14.6667H1.33333H0V11.1111V1.33333V0H1.33333ZM5.33333 8.44444V9.77778H2.66667V8.44444H5.33333ZM10.6667 8.44444V9.77778H6.22222V8.44444H10.6667Z"
      fill="currentColor"
    />
  </svg>
)

export const CreditCardIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
