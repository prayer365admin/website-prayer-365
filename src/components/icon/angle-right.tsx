'use client'

import React from 'react'
import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'

type CustomIconComponentProps = GetProps<typeof Icon>

const IconSvg = () => (
  <svg width="1em" height="1em" viewBox="0 0 8 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7.62532 6.4832L7.05426 7.05426L1.71318 12.4289L1.14212 13L0 11.8579L0.571059 11.2868L5.37468 6.4832L0.571059 1.67959L0 1.10853L1.14212 0L1.71318 0.571059L7.08786 5.91214L7.65891 6.4832H7.62532Z"
      fill="currentColor"
    />
  </svg>
)

export const AngleRightIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)
