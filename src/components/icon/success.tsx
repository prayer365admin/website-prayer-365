'use client'

import Icon from '@ant-design/icons'
import type { GetProps } from 'antd'
import React from 'react'

type CustomIconComponentProps = GetProps<typeof Icon>

// Source: public/icons/icon-success.svg. The original 120 × 120 artwork and
// colors are preserved; fontSize controls its rendered dimensions.
const IconSvg = () => (
  <svg
    fill="none"
    height="1em"
    viewBox="0 0 120 120"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect fill="white" height="117" rx="58.5" width="117" x="1.5" y="1.5" />
    <rect height="117" rx="58.5" stroke="#0AC28E" strokeWidth="3" width="117" x="1.5" y="1.5" />
    <path d="M32.5 57L51.5 78L87.5 42" stroke="#0AC28E" strokeWidth="3" />
  </svg>
)

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={IconSvg} {...props} />
)

export { CustomIcon as SuccessIcon }
